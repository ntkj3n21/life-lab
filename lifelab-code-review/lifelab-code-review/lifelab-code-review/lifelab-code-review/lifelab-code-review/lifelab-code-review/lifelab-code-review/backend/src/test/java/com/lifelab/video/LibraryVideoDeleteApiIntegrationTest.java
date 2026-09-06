package com.lifelab.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
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
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
import com.lifelab.video.repository.LibraryVideoRepository;
import com.lifelab.video.repository.LibraryVideoTagRepository;
import com.lifelab.video.repository.YouTubeVideoRepository;
import com.lifelab.watch.repository.WatchSessionRepository;

import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "app.security.jwt.secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "app.security.cookie.secure=false"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class LibraryVideoDeleteApiIntegrationTest {

    private static final String PASSWORD = "Password123";

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
    private LibraryVideoTagRepository libraryVideoTagRepository;

    @Autowired
    private WatchSessionRepository watchSessionRepository;

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
    void impactAndDeleteRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/library/videos/{id}/delete-impact", 1L))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        CsrfExchange guestCsrf = fetchCsrf();
        mockMvc.perform(delete("/api/library/videos/{id}", 1L)
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void impactReportsOwnedDeleteAndPreserveCountsWithoutMutation() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        YouTubeVideo source = createSource("shared-impact");
        LibraryVideo ownedVideo = createLibraryVideo(owner, source);
        LibraryVideo otherVideo = createLibraryVideo(other, source);
        insertWatchSession(ownedVideo.getId());
        insertWatchSession(ownedVideo.getId());
        insertWatchSession(otherVideo.getId());
        Long firstTag = insertTag(owner.getId(), "First", "first");
        Long secondTag = insertTag(owner.getId(), "Second", "second");
        insertTagLink(ownedVideo.getId(), firstTag);
        insertTagLink(ownedVideo.getId(), secondTag);
        Long ownerNoteOne = insertNote(owner.getId(), source.getId(), "Owner note one");
        Long ownerNoteTwo = insertNote(owner.getId(), source.getId(), "Owner note two");
        insertTask(owner.getId(), ownerNoteOne, "Owner task one");
        insertTask(owner.getId(), ownerNoteTwo, "Owner task two");
        Long otherNote = insertNote(other.getId(), source.getId(), "Other note");
        insertTask(other.getId(), otherNote, "Other task");
        Map<String, Long> countsBefore = tableCounts();
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos/{id}/delete-impact", ownedVideo.getId())
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.libraryVideoId").value(ownedVideo.getId()))
                .andExpect(jsonPath("$.watchSessionCountToDelete").value(2))
                .andExpect(jsonPath("$.tagLinkCountToDelete").value(2))
                .andExpect(jsonPath("$.noteCountPreserved").value(2))
                .andExpect(jsonPath("$.taskCountPreserved").value(2))
                .andExpect(jsonPath("$.youtubeSourcePreserved").value(true))
                .andExpect(jsonPath("$.accountId").doesNotExist());

        assertThat(tableCounts()).isEqualTo(countsBefore);
    }

    @Test
    void impactHidesUnknownAndCrossAccountOwnership() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        LibraryVideo otherVideo = createLibraryVideo(other, createSource("private-impact"));
        Cookie accessToken = login(owner.getEmail());

        for (Long id : new Long[] {Long.MAX_VALUE, otherVideo.getId()}) {
            mockMvc.perform(get("/api/library/videos/{id}/delete-impact", id).cookie(accessToken))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("The library video could not be found."));
        }
    }

    @Test
    void authenticatedDeleteRequiresCsrf() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("csrf-delete"));
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(delete("/api/library/videos/{id}", video.getId()).cookie(accessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        assertThat(libraryVideoRepository.findById(video.getId())).isPresent();
    }

    @Test
    void crossAccountDeleteReturnsSafeNotFoundAndKeepsTarget() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        LibraryVideo otherVideo = createLibraryVideo(other, createSource("private-delete"));
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        mockMvc.perform(delete("/api/library/videos/{id}", otherVideo.getId())
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));

        assertThat(libraryVideoRepository.findById(otherVideo.getId())).isPresent();
    }

    @Test
    void ownerDeleteCascadesDirectDependentsAndPreservesContextAndSharedData() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        YouTubeVideo source = createSource("shared-delete");
        LibraryVideo ownedVideo = createLibraryVideo(owner, source);
        LibraryVideo otherVideo = createLibraryVideo(other, source);
        insertWatchSession(ownedVideo.getId());
        insertWatchSession(ownedVideo.getId());
        Long tagId = insertTag(owner.getId(), "Keep tag", "keep tag");
        insertTagLink(ownedVideo.getId(), tagId);
        Long noteId = insertNote(owner.getId(), source.getId(), "Context remains");
        Long taskId = insertTask(owner.getId(), noteId, "Task remains");
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        mockMvc.perform(delete("/api/library/videos/{id}", ownedVideo.getId())
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());

        assertThat(libraryVideoRepository.findById(ownedVideo.getId())).isEmpty();
        assertThat(watchSessionRepository.countByLibraryVideo_Id(ownedVideo.getId())).isZero();
        assertThat(libraryVideoTagRepository.countByLibraryVideo_Id(ownedVideo.getId())).isZero();
        assertThat(count("tags", "id", tagId)).isOne();
        assertThat(youTubeVideoRepository.findById(source.getId())).isPresent();
        assertThat(count("notes", "id", noteId)).isOne();
        assertThat(count("tasks", "id", taskId)).isOne();
        assertThat(queryLong("SELECT youtube_source_id FROM notes WHERE id = ?", noteId))
                .isEqualTo(source.getId());
        assertThat(queryLong("SELECT source_note_id FROM tasks WHERE id = ?", taskId))
                .isEqualTo(noteId);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT source_status FROM tasks WHERE id = ?", String.class, taskId))
                .isEqualTo("HAS_SOURCE");
        assertThat(libraryVideoRepository.findById(otherVideo.getId())).isPresent();

        mockMvc.perform(get("/api/library/videos/{id}", ownedVideo.getId()).cookie(accessToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));
    }

    @Test
    void deletingLastLibraryEntryStillPreservesYouTubeSource() throws Exception {
        Account owner = createAccount("owner@example.com");
        YouTubeVideo source = createSource("last-entry");
        LibraryVideo video = createLibraryVideo(owner, source);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        mockMvc.perform(delete("/api/library/videos/{id}", video.getId())
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());

        assertThat(libraryVideoRepository.count()).isZero();
        assertThat(youTubeVideoRepository.findById(source.getId())).isPresent();
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
    }

    private YouTubeVideo createSource(String youtubeVideoId) {
        OffsetDateTime now = OffsetDateTime.now();
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                "Source title",
                "Source channel",
                "https://image.example/thumbnail.jpg",
                321,
                OffsetDateTime.parse("2024-04-15T09:30:00Z"),
                YouTubeAvailabilityStatus.AVAILABLE,
                now));
    }

    private LibraryVideo createLibraryVideo(Account account, YouTubeVideo source) {
        return libraryVideoRepository.saveAndFlush(
                LibraryVideo.create(account, source, OffsetDateTime.now()));
    }

    private void insertWatchSession(Long libraryVideoId) {
        jdbcTemplate.update("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 60, 'VALID')
                """, libraryVideoId);
    }

    private Long insertTag(Long accountId, String name, String normalizedName) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tags (account_id, name, normalized_name, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, name, normalizedName);
    }

    private void insertTagLink(Long libraryVideoId, Long tagId) {
        jdbcTemplate.update(
                "INSERT INTO library_video_tags (library_video_id, tag_id) VALUES (?, ?)",
                libraryVideoId,
                tagId);
    }

    private Long insertNote(Long accountId, Long youtubeSourceId, String content) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId, content);
    }

    private Long insertTask(Long accountId, Long noteId, String title) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, ?, 'HAS_SOURCE', ?, NULL, 'NOT_STARTED', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, noteId, title);
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

    private long count(String table, String column, Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?",
                Long.class,
                id);
    }

    private Long queryLong(String sql, Long id) {
        return jdbcTemplate.queryForObject(sql, Long.class, id);
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

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }
}
