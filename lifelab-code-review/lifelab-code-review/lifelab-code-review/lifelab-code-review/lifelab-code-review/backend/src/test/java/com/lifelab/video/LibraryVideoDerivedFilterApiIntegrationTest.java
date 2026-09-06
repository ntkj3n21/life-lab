package com.lifelab.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
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
class LibraryVideoDerivedFilterApiIntegrationTest {

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
    void derivedFiltersRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/library/videos").queryParam("watched", "true"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void watchedDependsOnlyOnExistenceOfValidSessionAndNeverDuplicatesVideo() throws Exception {
        Account owner = createAccount("watched@example.com");
        LibraryVideo valid = createVideo(owner, "watched-valid", "Video", 100, BASE_TIME);
        LibraryVideo pending = createVideo(owner, "watched-pending", "Video", 100, BASE_TIME.plusSeconds(1));
        LibraryVideo invalid = createVideo(owner, "watched-invalid", "Video", 100, BASE_TIME.plusSeconds(2));
        LibraryVideo undetermined = createVideo(
                owner, "watched-undetermined", "Video", 100, BASE_TIME.plusSeconds(3));
        LibraryVideo mixture = createVideo(owner, "watched-mixture", "Video", 100, BASE_TIME.plusSeconds(4));
        LibraryVideo noSessions = createVideo(owner, "watched-none", "Video", 100, BASE_TIME.plusSeconds(5));
        insertWatchSession(valid.getId(), "VALID");
        insertWatchSession(valid.getId(), "VALID");
        insertWatchSession(pending.getId(), "PENDING");
        insertWatchSession(invalid.getId(), "INVALID");
        insertWatchSession(undetermined.getId(), "UNDETERMINED");
        insertWatchSession(mixture.getId(), "PENDING");
        insertWatchSession(mixture.getId(), "INVALID");
        insertWatchSession(mixture.getId(), "VALID");
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("watched", "true")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(mixture.getId()))
                .andExpect(jsonPath("$.items[1].id").value(valid.getId()));

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("watched", "false")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.items[0].id").value(noSessions.getId()))
                .andExpect(jsonPath("$.items[1].id").value(undetermined.getId()))
                .andExpect(jsonPath("$.items[2].id").value(invalid.getId()))
                .andExpect(jsonPath("$.items[3].id").value(pending.getId()));
    }

    @Test
    void libraryResponsesExposeOnlyValidDerivedWatchStatistics() throws Exception {
        Account owner = createAccount("watch-stats@example.com");
        LibraryVideo watched = createVideo(owner, "stats-watched", "Video", 100, BASE_TIME);
        LibraryVideo nonValidOnly = createVideo(
                owner, "stats-non-valid", "Video", 100, BASE_TIME.plusSeconds(1));
        LibraryVideo neverWatched = createVideo(
                owner, "stats-never", "Video", 100, BASE_TIME.plusSeconds(2));

        OffsetDateTime firstValid = BASE_TIME.plusDays(1);
        OffsetDateTime latestValid = BASE_TIME.plusDays(2);
        OffsetDateTime laterButInvalid = BASE_TIME.plusDays(10);

        insertWatchSession(watched.getId(), "VALID", firstValid);
        insertWatchSession(watched.getId(), "VALID", latestValid);
        insertWatchSession(watched.getId(), "PENDING", laterButInvalid);
        insertWatchSession(watched.getId(), "INVALID", laterButInvalid.plusDays(1));
        insertWatchSession(watched.getId(), "UNDETERMINED", laterButInvalid.plusDays(2));

        insertWatchSession(nonValidOnly.getId(), "PENDING", firstValid);
        insertWatchSession(nonValidOnly.getId(), "INVALID", latestValid);
        insertWatchSession(nonValidOnly.getId(), "UNDETERMINED", laterButInvalid);

        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos/{id}", watched.getId()).cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watched").value(true))
                .andExpect(jsonPath("$.viewCount").value(2))
                .andExpect(jsonPath("$.lastWatchedAt").value(
                        latestValid.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)));

        mockMvc.perform(get("/api/library/videos/{id}", nonValidOnly.getId()).cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watched").value(false))
                .andExpect(jsonPath("$.viewCount").value(0))
                .andExpect(jsonPath("$.lastWatchedAt").doesNotExist());

        mockMvc.perform(get("/api/library/videos/{id}", neverWatched.getId()).cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watched").value(false))
                .andExpect(jsonPath("$.viewCount").value(0))
                .andExpect(jsonPath("$.lastWatchedAt").doesNotExist());
    }

    @Test
    void anotherAccountsValidSessionDoesNotAffectOwnersLibraryVideo() throws Exception {
        Account owner = createAccount("watch-owner@example.com");
        Account other = createAccount("watch-other@example.com");
        YouTubeVideo source = createSource("shared-watch", "Shared", 100);
        LibraryVideo ownerVideo = createLibraryVideo(owner, source, BASE_TIME);
        LibraryVideo otherVideo = createLibraryVideo(other, source, BASE_TIME.plusSeconds(1));
        insertWatchSession(otherVideo.getId(), "VALID");
        Cookie token = login(owner.getEmail());

        assertSingleResult(token, "watched", "false", ownerVideo.getId());
        assertEmptyResult(token, "watched", "true");
    }

    @Test
    void hasNotesIsScopedToAccountAndSharedYoutubeSource() throws Exception {
        Account owner = createAccount("notes-owner@example.com");
        Account other = createAccount("notes-other@example.com");
        YouTubeVideo otherOnlySource = createSource("notes-other-only", "Shared", 100);
        LibraryVideo withoutOwnNote = createLibraryVideo(owner, otherOnlySource, BASE_TIME);
        createLibraryVideo(other, otherOnlySource, BASE_TIME.plusSeconds(1));
        insertNote(other.getId(), otherOnlySource.getId());

        YouTubeVideo ownSource = createSource("notes-own", "Owned context", 100);
        LibraryVideo original = createLibraryVideo(owner, ownSource, BASE_TIME.plusSeconds(2));
        insertNote(owner.getId(), ownSource.getId());
        libraryVideoRepository.delete(original);
        libraryVideoRepository.flush();
        LibraryVideo readded = createLibraryVideo(owner, ownSource, BASE_TIME.plusSeconds(3));
        Cookie token = login(owner.getEmail());

        assertSingleResult(token, "hasNotes", "true", readded.getId());
        assertSingleResult(token, "hasNotes", "false", withoutOwnNote.getId());
    }

    @Test
    void watchedAndHasNotesTrueAndFalseValuesCombineWithAnd() throws Exception {
        Account owner = createAccount("derived-and@example.com");
        LibraryVideo both = createVideo(owner, "derived-both", "Video", 100, BASE_TIME);
        LibraryVideo watchedOnly = createVideo(owner, "derived-watched", "Video", 100, BASE_TIME.plusSeconds(1));
        LibraryVideo notesOnly = createVideo(owner, "derived-notes", "Video", 100, BASE_TIME.plusSeconds(2));
        LibraryVideo neither = createVideo(owner, "derived-neither", "Video", 100, BASE_TIME.plusSeconds(3));
        insertWatchSession(both.getId(), "VALID");
        insertWatchSession(watchedOnly.getId(), "VALID");
        insertNote(owner.getId(), both.getYoutubeSource().getId());
        insertNote(owner.getId(), notesOnly.getYoutubeSource().getId());
        Cookie token = login(owner.getEmail());

        assertSingleResult(token, "watched", "true", "hasNotes", "true", both.getId());
        assertSingleResult(token, "watched", "false", "hasNotes", "false", neither.getId());
    }

    @Test
    void derivedFiltersCombineWithKeywordAndEveryStaticFilterGroup() throws Exception {
        Account owner = createAccount("all-groups@example.com");
        Tag tag = createTag(owner, "Learning", "learning");
        LibraryVideo exact = createVideo(owner, "all-exact", "Study Guide", 120, BASE_TIME);
        LibraryVideo noNote = createVideo(owner, "all-no-note", "Study Guide", 120, BASE_TIME.plusSeconds(1));
        LibraryVideo wrongDuration = createVideo(
                owner, "all-duration", "Study Guide", 301, BASE_TIME.plusSeconds(2));
        for (LibraryVideo video : new LibraryVideo[] {exact, noNote, wrongDuration}) {
            insertRelation(video.getId(), tag.getId());
            insertWatchSession(video.getId(), "VALID");
        }
        insertNote(owner.getId(), exact.getYoutubeSource().getId());
        insertNote(owner.getId(), wrongDuration.getYoutubeSource().getId());
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("q", "study")
                        .queryParam("minDurationSeconds", "60")
                        .queryParam("maxDurationSeconds", "300")
                        .queryParam("publishedFrom", "2026-03-01")
                        .queryParam("publishedTo", "2026-03-31")
                        .queryParam("addedFrom", "2026-03-01")
                        .queryParam("addedTo", "2026-03-31")
                        .queryParam("tagId", tag.getId().toString())
                        .queryParam("watched", "true")
                        .queryParam("hasNotes", "true")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(exact.getId()));
    }

    @Test
    void derivedPaginationIsAccountScopedDuplicateFreeAndReadOnly() throws Exception {
        Account owner = createAccount("derived-page@example.com");
        Account other = createAccount("derived-page-other@example.com");
        LibraryVideo first = createVideo(owner, "derived-page-1", "Video", 100, BASE_TIME);
        LibraryVideo second = createVideo(owner, "derived-page-2", "Video", 100, BASE_TIME.plusSeconds(1));
        LibraryVideo third = createVideo(owner, "derived-page-3", "Video", 100, BASE_TIME.plusSeconds(2));
        LibraryVideo privateVideo = createVideo(
                other, "derived-page-private", "Video", 100, BASE_TIME.plusSeconds(3));
        for (LibraryVideo video : new LibraryVideo[] {first, second, third, privateVideo}) {
            insertWatchSession(video.getId(), "VALID");
            insertNote(video.getAccount().getId(), video.getYoutubeSource().getId());
        }
        insertWatchSession(first.getId(), "VALID");
        Map<String, Long> countsBefore = tableCounts();
        OffsetDateTime updatedAtBefore = timestamp(
                "SELECT updated_at FROM library_videos WHERE id = ?", first.getId());
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("watched", "true")
                        .queryParam("hasNotes", "true")
                        .queryParam("page", "0")
                        .queryParam("size", "2")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/library/videos")
                        .queryParam("watched", "true")
                        .queryParam("hasNotes", "true")
                        .queryParam("page", "1")
                        .queryParam("size", "2")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(3));

        assertThat(tableCounts()).isEqualTo(countsBefore);
        assertThat(timestamp("SELECT updated_at FROM library_videos WHERE id = ?", first.getId()))
                .isEqualTo(updatedAtBefore);
    }

    private Account createAccount(String email) {
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                BASE_TIME));
    }

    private LibraryVideo createVideo(
            Account account,
            String youtubeVideoId,
            String title,
            Integer durationSeconds,
            OffsetDateTime addedAt) {
        return createLibraryVideo(account, createSource(youtubeVideoId, title, durationSeconds), addedAt);
    }

    private YouTubeVideo createSource(String youtubeVideoId, String title, Integer durationSeconds) {
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                title,
                "Channel",
                "https://image.example/" + youtubeVideoId + ".jpg",
                durationSeconds,
                BASE_TIME,
                YouTubeAvailabilityStatus.AVAILABLE,
                BASE_TIME));
    }

    private LibraryVideo createLibraryVideo(Account account, YouTubeVideo source, OffsetDateTime addedAt) {
        return libraryVideoRepository.saveAndFlush(LibraryVideo.create(account, source, addedAt));
    }

    private Tag createTag(Account account, String name, String normalizedName) {
        return tagRepository.saveAndFlush(Tag.create(account, name, normalizedName, BASE_TIME));
    }

    private void insertRelation(Long libraryVideoId, Long tagId) {
        jdbcTemplate.update(
                "INSERT INTO library_video_tags (library_video_id, tag_id) VALUES (?, ?)",
                libraryVideoId,
                tagId);
    }

    private void insertWatchSession(Long libraryVideoId, String status) {
        jdbcTemplate.update("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 30, ?)
                """, libraryVideoId, status);
    }

    private void insertWatchSession(
            Long libraryVideoId,
            String status,
            OffsetDateTime startedAt) {
        jdbcTemplate.update("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, ?, ?, ?, 30, ?)
                """,
                libraryVideoId,
                startedAt,
                startedAt.plusSeconds(30),
                startedAt.plusSeconds(30),
                status);
    }

    private Long insertNote(Long accountId, Long youtubeSourceId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, 'Context', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId);
    }

    private void assertSingleResult(Cookie token, String parameter, String value, Long expectedId)
            throws Exception {
        mockMvc.perform(get("/api/library/videos")
                        .queryParam(parameter, value)
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(expectedId));
    }

    private void assertSingleResult(
            Cookie token,
            String firstParameter,
            String firstValue,
            String secondParameter,
            String secondValue,
            Long expectedId) throws Exception {
        mockMvc.perform(get("/api/library/videos")
                        .queryParam(firstParameter, firstValue)
                        .queryParam(secondParameter, secondValue)
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(expectedId));
    }

    private void assertEmptyResult(Cookie token, String parameter, String value) throws Exception {
        mockMvc.perform(get("/api/library/videos")
                        .queryParam(parameter, value)
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0));
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

    private CsrfExchange fetchCsrf() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/csrf"))
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