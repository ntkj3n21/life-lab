package com.lifelab.note;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.lifelab.TestcontainersConfiguration;
import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.auth.security.JwtCookieService;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.domain.Tag;
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
import com.lifelab.video.repository.LibraryVideoRepository;
import com.lifelab.video.repository.TagRepository;
import com.lifelab.video.repository.YouTubeVideoRepository;

import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "app.security.jwt.secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "app.security.cookie.secure=false"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class VideoNoteApiIntegrationTest {

    private static final String PASSWORD = "Password123";
    private static final OffsetDateTime BASE_TIME = OffsetDateTime.parse("2026-03-15T12:00:00Z");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private YouTubeVideoRepository youTubeVideoRepository;

    @Autowired
    private LibraryVideoRepository libraryVideoRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private YouTubeMetadataClient youTubeMetadataClient;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE tasks, notes, watch_sessions, library_video_tags, tags,
                    library_videos, youtube_videos, accounts RESTART IDENTITY CASCADE
                """);
    }

    @AfterEach
    void removeFixtures() {
        cleanDatabase();
    }

    @Test
    void noteEndpointsRequireAuthenticationAndPostRequiresCsrf() throws Exception {
        Account owner = createAccount("security@example.com");
        LibraryVideo video = createVideo(owner, "note-security");

        mockMvc.perform(get("/api/library/videos/{id}/notes", video.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        CsrfExchange guestCsrf = fetchCsrf();
        mockMvc.perform(post("/api/library/videos/{id}/notes", video.getId())
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Context","timestampSeconds":10,
                                 "withoutTimestampConfirmed":false}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Cookie accessToken = login(owner.getEmail());
        mockMvc.perform(post("/api/library/videos/{id}/notes", video.getId())
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Context","timestampSeconds":10,
                                 "withoutTimestampConfirmed":false}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void ownerCreatesTimestampedNoteUsingServerControlledAccountAndSource() throws Exception {
        Account owner = createAccount("create-owner@example.com");
        Account other = createAccount("create-other@example.com");
        LibraryVideo video = createVideo(owner, "note-create-owner");
        LibraryVideo otherVideo = createVideo(other, "note-create-other");
        AuthenticatedSession session = authenticate(owner.getEmail());

        mockMvc.perform(post("/api/library/videos/{id}/notes", video.getId())
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Captured context","timestampSeconds":42,
                                 "withoutTimestampConfirmed":false,
                                 "accountId":%d,"youtubeSourceId":%d}
                                """.formatted(other.getId(), otherVideo.getYoutubeSource().getId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.content").value("Captured context"))
                .andExpect(jsonPath("$.timestampSeconds").value(42))
                .andExpect(jsonPath("$.youtubeSource.id").value(video.getYoutubeSource().getId()))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty())
                .andExpect(jsonPath("$.account").doesNotExist())
                .andExpect(jsonPath("$.accountId").doesNotExist());

        Map<String, Object> persisted = jdbcTemplate.queryForMap(
                "SELECT account_id, youtube_source_id, content, timestamp_seconds FROM notes");
        assertThat(((Number) persisted.get("account_id")).longValue()).isEqualTo(owner.getId());
        assertThat(((Number) persisted.get("youtube_source_id")).longValue())
                .isEqualTo(video.getYoutubeSource().getId());
        assertThat(persisted.get("content")).isEqualTo("Captured context");
        assertThat(((Number) persisted.get("timestamp_seconds")).intValue()).isEqualTo(42);
        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void invalidContentTimestampAndMissingConfirmationReturnValidationErrors() throws Exception {
        Account owner = createAccount("validation@example.com");
        LibraryVideo video = createVideo(owner, "note-validation");
        AuthenticatedSession session = authenticate(owner.getEmail());

        assertPostValidationError(session, video.getId(), """
                {"content":"     ","timestampSeconds":1,"withoutTimestampConfirmed":false}
                """, "content");
        assertPostValidationError(session, video.getId(), """
                {"content":"Context","timestampSeconds":-1,"withoutTimestampConfirmed":false}
                """, "timestampSeconds");
        assertPostValidationError(session, video.getId(), """
                {"content":"Context","timestampSeconds":null,"withoutTimestampConfirmed":false}
                """, "withoutTimestampConfirmed");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notes", Long.class)).isZero();
    }

    @Test
    void confirmedMissingTimestampStaysNullWhileZeroRemainsARealTimestamp() throws Exception {
        Account owner = createAccount("timestamp@example.com");
        LibraryVideo video = createVideo(owner, "note-timestamp");
        AuthenticatedSession session = authenticate(owner.getEmail());

        createNote(session, video.getId(), "Without position", null, true)
                .andExpect(jsonPath("$.timestampSeconds").doesNotExist());
        createNote(session, video.getId(), "At the beginning", 0, false)
                .andExpect(jsonPath("$.timestampSeconds").value(0));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM notes WHERE timestamp_seconds IS NULL", Long.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM notes WHERE timestamp_seconds = 0", Long.class)).isEqualTo(1);
    }

    @Test
    void unknownAndCrossAccountLibraryVideosUseSameSafeNotFoundResponse() throws Exception {
        Account owner = createAccount("ownership-owner@example.com");
        Account other = createAccount("ownership-other@example.com");
        LibraryVideo otherVideo = createVideo(other, "note-private");
        AuthenticatedSession session = authenticate(owner.getEmail());

        for (Long libraryVideoId : new Long[] {999999L, otherVideo.getId()}) {
            mockMvc.perform(post("/api/library/videos/{id}/notes", libraryVideoId)
                            .cookie(session.accessToken(), session.csrf().cookie())
                            .header(session.csrf().headerName(), session.csrf().token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"content":"Context","timestampSeconds":5,
                                     "withoutTimestampConfirmed":false}
                                    """))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));
            mockMvc.perform(get("/api/library/videos/{id}/notes", libraryVideoId)
                            .cookie(session.accessToken()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));
        }
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM notes", Long.class)).isZero();
    }

    @Test
    void listIsAccountAndSourceScopedWithTimestampNullLastOrdering() throws Exception {
        Account owner = createAccount("list-owner@example.com");
        Account other = createAccount("list-other@example.com");
        YouTubeVideo sharedSource = createSource("note-list-shared");
        LibraryVideo ownerVideo = createLibraryVideo(owner, sharedSource, BASE_TIME);
        createLibraryVideo(other, sharedSource, BASE_TIME.plusSeconds(1));
        LibraryVideo otherSourceVideo = createVideo(owner, "note-list-other-source");
        Long timestampFiveFirst = insertNote(owner.getId(), sharedSource.getId(), "Five first", 5);
        Long timestampFiveSecond = insertNote(owner.getId(), sharedSource.getId(), "Five second", 5);
        Long timestampTen = insertNote(owner.getId(), sharedSource.getId(), "Ten", 10);
        Long withoutTimestamp = insertNote(owner.getId(), sharedSource.getId(), "No position", null);
        insertNote(other.getId(), sharedSource.getId(), "Other account", 1);
        insertNote(owner.getId(), otherSourceVideo.getYoutubeSource().getId(), "Other source", 2);
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos/{id}/notes", ownerVideo.getId())
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4))
                .andExpect(jsonPath("$[0].id").value(timestampFiveFirst))
                .andExpect(jsonPath("$[1].id").value(timestampFiveSecond))
                .andExpect(jsonPath("$[2].id").value(timestampTen))
                .andExpect(jsonPath("$[3].id").value(withoutTimestamp))
                .andExpect(jsonPath("$[3].timestampSeconds").doesNotExist())
                .andExpect(jsonPath("$[0].accountId").doesNotExist());
        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void createAndListMutateOnlyNotes() throws Exception {
        Account owner = createAccount("mutation@example.com");
        LibraryVideo video = createVideo(owner, "note-mutation");
        Tag tag = tagRepository.saveAndFlush(Tag.create(owner, "Context", "context", BASE_TIME));
        jdbcTemplate.update(
                "INSERT INTO library_video_tags (library_video_id, tag_id) VALUES (?, ?)",
                video.getId(), tag.getId());
        jdbcTemplate.update("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 30, 'VALID')
                """, video.getId());
        Long sourceNoteId = insertNote(owner.getId(), video.getYoutubeSource().getId(), "Task source", 1);
        insertTask(owner.getId(), sourceNoteId);
        AuthenticatedSession session = authenticate(owner.getEmail());
        Map<String, Long> countsBefore = tableCounts();
        OffsetDateTime videoUpdatedAt = timestamp(
                "SELECT updated_at FROM library_videos WHERE id = ?", video.getId());
        OffsetDateTime sourceUpdatedAt = timestamp(
                "SELECT updated_at FROM youtube_videos WHERE id = ?", video.getYoutubeSource().getId());

        createNote(session, video.getId(), "New context", 15, false);
        mockMvc.perform(get("/api/library/videos/{id}/notes", video.getId())
                        .cookie(session.accessToken()))
                .andExpect(status().isOk());

        Map<String, Long> countsAfter = tableCounts();
        assertThat(countsAfter.get("notes")).isEqualTo(countsBefore.get("notes") + 1);
        countsBefore.remove("notes");
        countsAfter.remove("notes");
        assertThat(countsAfter).isEqualTo(countsBefore);
        assertThat(timestamp("SELECT updated_at FROM library_videos WHERE id = ?", video.getId()))
                .isEqualTo(videoUpdatedAt);
        assertThat(timestamp(
                "SELECT updated_at FROM youtube_videos WHERE id = ?", video.getYoutubeSource().getId()))
                .isEqualTo(sourceUpdatedAt);
        verifyNoInteractions(youTubeMetadataClient);
    }

    private Account createAccount(String email) {
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                BASE_TIME));
    }

    private LibraryVideo createVideo(Account account, String youtubeVideoId) {
        return createLibraryVideo(account, createSource(youtubeVideoId), BASE_TIME);
    }

    private YouTubeVideo createSource(String youtubeVideoId) {
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                "Title",
                "Channel",
                "https://image.example/" + youtubeVideoId + ".jpg",
                100,
                BASE_TIME,
                YouTubeAvailabilityStatus.AVAILABLE,
                BASE_TIME));
    }

    private LibraryVideo createLibraryVideo(Account account, YouTubeVideo source, OffsetDateTime addedAt) {
        return libraryVideoRepository.saveAndFlush(LibraryVideo.create(account, source, addedAt));
    }

    private Long insertNote(Long accountId, Long youtubeSourceId, String content, Integer timestampSeconds) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId, content, timestampSeconds);
    }

    private void insertTask(Long accountId, Long noteId) {
        jdbcTemplate.update("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, ?, 'HAS_SOURCE', 'Task', NULL, 'NOT_STARTED', NULL,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, accountId, noteId);
    }

    private org.springframework.test.web.servlet.ResultActions createNote(
            AuthenticatedSession session,
            Long libraryVideoId,
            String content,
            Integer timestampSeconds,
            boolean confirmed) throws Exception {
        String timestampJson = timestampSeconds == null ? "null" : timestampSeconds.toString();
        return mockMvc.perform(post("/api/library/videos/{id}/notes", libraryVideoId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"%s","timestampSeconds":%s,
                                 "withoutTimestampConfirmed":%s}
                                """.formatted(content, timestampJson, confirmed)))
                .andExpect(status().isCreated());
    }

    private void assertPostValidationError(
            AuthenticatedSession session,
            Long libraryVideoId,
            String body,
            String field) throws Exception {
        mockMvc.perform(post("/api/library/videos/{id}/notes", libraryVideoId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors." + field).exists());
    }

    private Map<String, Long> tableCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : new String[] {
                "accounts", "youtube_videos", "library_videos", "tags",
                "library_video_tags", "watch_sessions", "notes", "tasks"}) {
            counts.put(table, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class));
        }
        return counts;
    }

    private OffsetDateTime timestamp(String sql, Long id) {
        return jdbcTemplate.queryForObject(sql, OffsetDateTime.class, id);
    }

    private AuthenticatedSession authenticate(String email) throws Exception {
        Cookie accessToken = login(email);
        return new AuthenticatedSession(accessToken, fetchCsrf(accessToken));
    }

    private Cookie login(String email) throws Exception {
        CsrfExchange csrf = fetchCsrf();
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        Cookie accessToken = result.getResponse().getCookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME);
        assertThat(accessToken).isNotNull();
        return accessToken;
    }

    private CsrfExchange fetchCsrf(Cookie... cookies) throws Exception {
        var request = get("/api/auth/csrf");
        if (cookies.length > 0) {
            request.cookie(cookies);
        }
        MvcResult result = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn();
        MockHttpServletResponse response = result.getResponse();
        Cookie csrfCookie = response.getCookie("XSRF-TOKEN");
        JsonNode body = objectMapper.readTree(response.getContentAsByteArray());
        assertThat(csrfCookie).isNotNull();
        return new CsrfExchange(csrfCookie, csrfCookie.getValue(), body.get("headerName").stringValue());
    }

    private record AuthenticatedSession(Cookie accessToken, CsrfExchange csrf) {
    }

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }
}
