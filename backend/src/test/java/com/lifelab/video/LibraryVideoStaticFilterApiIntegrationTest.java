package com.lifelab.video;

import static org.assertj.core.api.Assertions.assertThat;
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
class LibraryVideoStaticFilterApiIntegrationTest {

    private static final String PASSWORD = "Password123";
    private static final OffsetDateTime BASE_TIME = OffsetDateTime.parse("2026-01-15T12:00:00Z");

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
    void filteredRequestRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/library/videos").queryParam("minDurationSeconds", "60"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void durationBoundsAreInclusiveAndExcludeUnknownDurations() throws Exception {
        Account owner = createAccount("duration@example.com");
        createVideo(owner, "duration-59", "Video", 59, BASE_TIME, BASE_TIME);
        LibraryVideo lower = createVideo(owner, "duration-60", "Video", 60, BASE_TIME, BASE_TIME.plusSeconds(1));
        LibraryVideo upper = createVideo(owner, "duration-300", "Video", 300, BASE_TIME, BASE_TIME.plusSeconds(2));
        createVideo(owner, "duration-301", "Video", 301, BASE_TIME, BASE_TIME.plusSeconds(3));
        createVideo(owner, "duration-null", "Video", null, BASE_TIME, BASE_TIME.plusSeconds(4));
        Cookie token = login(owner.getEmail());

        assertTotal(token, Map.of("minDurationSeconds", "60"), 3);
        assertTotal(token, Map.of("maxDurationSeconds", "300"), 3);

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("minDurationSeconds", "60")
                        .queryParam("maxDurationSeconds", "300")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[0].id").value(upper.getId()))
                .andExpect(jsonPath("$.items[1].id").value(lower.getId()));
    }

    @Test
    void invalidDurationValuesReturnStandardValidationErrors() throws Exception {
        Account owner = createAccount("duration-validation@example.com");
        Cookie token = login(owner.getEmail());

        assertValidationError(token, "minDurationSeconds", "-1", "minDurationSeconds");
        assertValidationError(token, "maxDurationSeconds", "-1", "maxDurationSeconds");
        mockMvc.perform(get("/api/library/videos")
                        .queryParam("minDurationSeconds", "301")
                        .queryParam("maxDurationSeconds", "300")
                        .cookie(token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.minDurationSeconds").exists());
    }

    @Test
    void publishedDateUsesInclusiveUtcCalendarBoundsAndExcludesNull() throws Exception {
        Account owner = createAccount("published@example.com");
        createVideo(owner, "published-before", "Video", 100,
                OffsetDateTime.parse("2025-12-31T23:59:59Z"), BASE_TIME);
        createVideo(owner, "published-lower", "Video", 100,
                OffsetDateTime.parse("2026-01-01T00:00:00Z"), BASE_TIME.plusSeconds(1));
        createVideo(owner, "published-upper", "Video", 100,
                OffsetDateTime.parse("2026-01-31T23:59:59.999Z"), BASE_TIME.plusSeconds(2));
        createVideo(owner, "published-after", "Video", 100,
                OffsetDateTime.parse("2026-02-01T00:00:00Z"), BASE_TIME.plusSeconds(3));
        createVideo(owner, "published-null", "Video", 100, null, BASE_TIME.plusSeconds(4));
        Cookie token = login(owner.getEmail());

        assertTotal(token, Map.of("publishedFrom", "2026-01-01"), 3);
        assertTotal(token, Map.of("publishedTo", "2026-01-31"), 3);
        assertTotal(token, Map.of("publishedFrom", "2026-01-01", "publishedTo", "2026-01-31"), 2);

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("publishedFrom", "2026-02-01")
                        .queryParam("publishedTo", "2026-01-01")
                        .cookie(token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.publishedFrom").exists());
    }

    @Test
    void addedDateUsesInclusiveUtcCalendarBounds() throws Exception {
        Account owner = createAccount("added@example.com");
        createVideo(owner, "added-before", "Video", 100, BASE_TIME,
                OffsetDateTime.parse("2025-12-31T23:59:59Z"));
        createVideo(owner, "added-lower", "Video", 100, BASE_TIME,
                OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        createVideo(owner, "added-upper", "Video", 100, BASE_TIME,
                OffsetDateTime.parse("2026-01-31T23:59:59.999Z"));
        createVideo(owner, "added-after", "Video", 100, BASE_TIME,
                OffsetDateTime.parse("2026-02-01T00:00:00Z"));
        Cookie token = login(owner.getEmail());

        assertTotal(token, Map.of("addedFrom", "2026-01-01"), 3);
        assertTotal(token, Map.of("addedTo", "2026-01-31"), 3);
        assertTotal(token, Map.of("addedFrom", "2026-01-01", "addedTo", "2026-01-31"), 2);

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("addedFrom", "2026-02-01")
                        .queryParam("addedTo", "2026-01-01")
                        .cookie(token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.addedFrom").exists());
    }

    @Test
    void tagFiltersUseOrSemanticsRemainDistinctAndEnforceOwnership() throws Exception {
        Account owner = createAccount("tag-owner@example.com");
        Account other = createAccount("tag-other@example.com");
        Tag alpha = createTag(owner, "Alpha", "alpha");
        Tag beta = createTag(owner, "Beta", "beta");
        Tag otherTag = createTag(other, "Private", "private");
        LibraryVideo alphaVideo = createVideo(owner, "tag-alpha", "Video", 100, BASE_TIME, BASE_TIME);
        LibraryVideo betaVideo = createVideo(owner, "tag-beta", "Video", 100, BASE_TIME, BASE_TIME.plusSeconds(1));
        LibraryVideo bothVideo = createVideo(owner, "tag-both", "Video", 100, BASE_TIME, BASE_TIME.plusSeconds(2));
        createVideo(owner, "tag-none", "Video", 100, BASE_TIME, BASE_TIME.plusSeconds(3));
        insertRelation(alphaVideo.getId(), alpha.getId());
        insertRelation(betaVideo.getId(), beta.getId());
        insertRelation(bothVideo.getId(), alpha.getId());
        insertRelation(bothVideo.getId(), beta.getId());
        Cookie token = login(owner.getEmail());

        assertTotal(token, Map.of("tagId", alpha.getId().toString()), 2);
        mockMvc.perform(get("/api/library/videos")
                        .queryParam("tagId", alpha.getId().toString(), beta.getId().toString())
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.items.length()").value(3));

        for (Long invalidTagId : new Long[] {999999L, otherTag.getId()}) {
            mockMvc.perform(get("/api/library/videos")
                            .queryParam("tagId", invalidTagId.toString())
                            .cookie(token))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));
        }
    }

    @Test
    void keywordAndAllStaticGroupsCombineWithAndWhileRemovingOneBroadensResults() throws Exception {
        Account owner = createAccount("combined@example.com");
        Account other = createAccount("combined-other@example.com");
        Tag study = createTag(owner, "Study", "study");
        LibraryVideo exact = createVideo(owner, "combined-exact", "Study Session", 120,
                OffsetDateTime.parse("2026-03-10T10:00:00Z"), OffsetDateTime.parse("2026-04-10T10:00:00Z"));
        LibraryVideo missingTag = createVideo(owner, "combined-no-tag", "Study Session", 120,
                OffsetDateTime.parse("2026-03-11T10:00:00Z"), OffsetDateTime.parse("2026-04-11T10:00:00Z"));
        LibraryVideo wrongDuration = createVideo(owner, "combined-duration", "Study Session", 301,
                OffsetDateTime.parse("2026-03-12T10:00:00Z"), OffsetDateTime.parse("2026-04-12T10:00:00Z"));
        insertRelation(exact.getId(), study.getId());
        insertRelation(wrongDuration.getId(), study.getId());
        LibraryVideo privateMatch = createVideo(other, "combined-private", "Study Session", 120,
                OffsetDateTime.parse("2026-03-10T10:00:00Z"), OffsetDateTime.parse("2026-04-10T10:00:00Z"));
        Tag privateTag = createTag(other, "Study", "study");
        insertRelation(privateMatch.getId(), privateTag.getId());
        Cookie token = login(owner.getEmail());

        var allFilters = get("/api/library/videos")
                .queryParam("q", "study")
                .queryParam("minDurationSeconds", "60")
                .queryParam("maxDurationSeconds", "300")
                .queryParam("publishedFrom", "2026-03-01")
                .queryParam("publishedTo", "2026-03-31")
                .queryParam("addedFrom", "2026-04-01")
                .queryParam("addedTo", "2026-04-30")
                .queryParam("tagId", study.getId().toString())
                .cookie(token);
        mockMvc.perform(allFilters)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(exact.getId()));

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("q", "study")
                        .queryParam("minDurationSeconds", "60")
                        .queryParam("maxDurationSeconds", "300")
                        .queryParam("publishedFrom", "2026-03-01")
                        .queryParam("publishedTo", "2026-03-31")
                        .queryParam("addedFrom", "2026-04-01")
                        .queryParam("addedTo", "2026-04-30")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[0].id").value(missingTag.getId()))
                .andExpect(jsonPath("$.items[1].id").value(exact.getId()));

        assertTotal(token, Map.of("q", "does-not-match", "minDurationSeconds", "0"), 0);
    }

    @Test
    void filteredPaginationCountsOnlyOwnedMatchesAndDoesNotMutateData() throws Exception {
        Account owner = createAccount("page-owner@example.com");
        Account other = createAccount("page-other@example.com");
        LibraryVideo first = createVideo(owner, "page-first", "Video", 100, BASE_TIME, BASE_TIME);
        createVideo(owner, "page-second", "Video", 150, BASE_TIME, BASE_TIME.plusSeconds(1));
        createVideo(owner, "page-third", "Video", 200, BASE_TIME, BASE_TIME.plusSeconds(2));
        createVideo(owner, "page-excluded", "Video", 99, BASE_TIME, BASE_TIME.plusSeconds(3));
        createVideo(other, "page-private", "Video", 150, BASE_TIME, BASE_TIME.plusSeconds(4));
        Tag tag = createTag(owner, "Preserved", "preserved");
        insertRelation(first.getId(), tag.getId());
        insertWatchSession(first.getId());
        Long noteId = insertNote(owner.getId(), first.getYoutubeSource().getId());
        insertTask(owner.getId(), noteId);
        Map<String, Long> before = tableCounts();
        OffsetDateTime updatedAt = timestamp("SELECT updated_at FROM library_videos WHERE id = ?", first.getId());
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("minDurationSeconds", "100")
                        .queryParam("page", "0")
                        .queryParam("size", "2")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/library/videos")
                        .queryParam("minDurationSeconds", "100")
                        .queryParam("page", "1")
                        .queryParam("size", "2")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(3));

        assertThat(tableCounts()).isEqualTo(before);
        assertThat(timestamp("SELECT updated_at FROM library_videos WHERE id = ?", first.getId()))
                .isEqualTo(updatedAt);
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
            OffsetDateTime publishedAt,
            OffsetDateTime addedAt) {
        YouTubeVideo source = youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                title,
                "Channel",
                "https://image.example/" + youtubeVideoId + ".jpg",
                durationSeconds,
                publishedAt,
                YouTubeAvailabilityStatus.AVAILABLE,
                addedAt));
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

    private void insertWatchSession(Long libraryVideoId) {
        jdbcTemplate.update("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 30, 'VALID')
                """, libraryVideoId);
    }

    private Long insertNote(Long accountId, Long youtubeSourceId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, 'Context', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId);
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

    private void assertTotal(Cookie token, Map<String, String> parameters, int expected) throws Exception {
        var request = get("/api/library/videos").cookie(token);
        parameters.forEach(request::queryParam);
        mockMvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(expected));
    }

    private void assertValidationError(Cookie token, String parameter, String value, String field) throws Exception {
        mockMvc.perform(get("/api/library/videos")
                        .queryParam(parameter, value)
                        .cookie(token))
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
