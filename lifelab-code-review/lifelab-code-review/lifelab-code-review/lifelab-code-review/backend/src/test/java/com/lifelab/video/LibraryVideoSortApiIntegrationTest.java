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
class LibraryVideoSortApiIntegrationTest {

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
    void sortedRequestRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/library/videos")
                        .queryParam("sortBy", "viewCount")
                        .queryParam("sortDirection", "desc"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void addedAtDefaultAscendingDescendingAndIdTieBreakAreDeterministic() throws Exception {
        Account owner = createAccount("added-sort@example.com");
        LibraryVideo old = createVideo(owner, "sort-old", "Video", 100, BASE_TIME.minusDays(1));
        LibraryVideo equalLowerId = createVideo(owner, "sort-equal-1", "Video", 100, BASE_TIME);
        LibraryVideo equalHigherId = createVideo(owner, "sort-equal-2", "Video", 100, BASE_TIME);
        Cookie token = login(owner.getEmail());

        assertOrder(token, Map.of(), equalHigherId, equalLowerId, old);
        assertOrder(token, Map.of("sortBy", "addedAt", "sortDirection", "desc"),
                equalHigherId, equalLowerId, old);
        assertOrder(token, Map.of("sortBy", "addedAt", "sortDirection", "asc"),
                old, equalLowerId, equalHigherId);
        assertOrder(token, Map.of("sortDirection", "asc"), old, equalLowerId, equalHigherId);
    }

    @Test
    void durationSortSupportsBothDirectionsAndAlwaysPlacesNullLast() throws Exception {
        Account owner = createAccount("duration-sort@example.com");
        LibraryVideo shortVideo = createVideo(owner, "sort-duration-short", "Video", 10, BASE_TIME);
        LibraryVideo longVideo = createVideo(owner, "sort-duration-long", "Video", 300, BASE_TIME.plusSeconds(1));
        LibraryVideo unknown = createVideo(owner, "sort-duration-null", "Video", null, BASE_TIME.plusSeconds(2));
        Cookie token = login(owner.getEmail());

        assertOrder(token, Map.of("sortBy", "duration", "sortDirection", "asc"),
                shortVideo, longVideo, unknown);
        assertOrder(token, Map.of("sortBy", "duration", "sortDirection", "desc"),
                longVideo, shortVideo, unknown);
    }

    @Test
    void viewCountUsesOnlyValidSessionsAndUsesIdTieBreak() throws Exception {
        Account owner = createAccount("view-count-sort@example.com");
        LibraryVideo zero = createVideo(owner, "sort-view-zero", "Video", 100, BASE_TIME);
        LibraryVideo nonValid = createVideo(owner, "sort-view-non-valid", "Video", 100, BASE_TIME.plusSeconds(1));
        LibraryVideo one = createVideo(owner, "sort-view-one", "Video", 100, BASE_TIME.plusSeconds(2));
        LibraryVideo three = createVideo(owner, "sort-view-three", "Video", 100, BASE_TIME.plusSeconds(3));
        insertWatchSession(nonValid.getId(), "PENDING", BASE_TIME.plusDays(5));
        insertWatchSession(nonValid.getId(), "INVALID", BASE_TIME.plusDays(6));
        insertWatchSession(nonValid.getId(), "UNDETERMINED", BASE_TIME.plusDays(7));
        insertWatchSession(one.getId(), "VALID", BASE_TIME);
        insertWatchSession(one.getId(), "PENDING", BASE_TIME.plusDays(8));
        for (int index = 0; index < 3; index++) {
            insertWatchSession(three.getId(), "VALID", BASE_TIME.plusHours(index));
        }
        Cookie token = login(owner.getEmail());

        assertOrder(token, Map.of("sortBy", "viewCount", "sortDirection", "desc"),
                three, one, nonValid, zero);
        assertOrder(token, Map.of("sortBy", "viewCount", "sortDirection", "asc"),
                zero, nonValid, one, three);
    }

    @Test
    void lastWatchedAtUsesLatestValidStartAndAlwaysPlacesUnwatchedLast() throws Exception {
        Account owner = createAccount("last-watch-sort@example.com");
        LibraryVideo early = createVideo(owner, "sort-last-early", "Video", 100, BASE_TIME);
        LibraryVideo late = createVideo(owner, "sort-last-late", "Video", 100, BASE_TIME.plusSeconds(1));
        LibraryVideo unwatched = createVideo(owner, "sort-last-none", "Video", 100, BASE_TIME.plusSeconds(2));
        insertWatchSession(early.getId(), "VALID", BASE_TIME.plusDays(1));
        insertWatchSession(early.getId(), "PENDING", BASE_TIME.plusDays(20));
        insertWatchSession(early.getId(), "INVALID", BASE_TIME.plusDays(21));
        insertWatchSession(late.getId(), "VALID", BASE_TIME.plusDays(2));
        insertWatchSession(unwatched.getId(), "UNDETERMINED", BASE_TIME.plusDays(30));
        Cookie token = login(owner.getEmail());

        assertOrder(token, Map.of("sortBy", "lastWatchedAt", "sortDirection", "desc"),
                late, early, unwatched);
        assertOrder(token, Map.of("sortBy", "lastWatchedAt", "sortDirection", "asc"),
                early, late, unwatched);
    }

    @Test
    void anotherAccountsSessionsOnSharedSourceDoNotAffectOrdering() throws Exception {
        Account owner = createAccount("shared-sort-owner@example.com");
        Account other = createAccount("shared-sort-other@example.com");
        YouTubeVideo shared = createSource("sort-shared", "Shared", 100);
        LibraryVideo ownerShared = createLibraryVideo(owner, shared, BASE_TIME);
        LibraryVideo ownerWatched = createVideo(owner, "sort-owner-watched", "Video", 100, BASE_TIME.plusSeconds(1));
        LibraryVideo otherShared = createLibraryVideo(other, shared, BASE_TIME.plusSeconds(2));
        for (int index = 0; index < 5; index++) {
            insertWatchSession(otherShared.getId(), "VALID", BASE_TIME.plusDays(index));
        }
        insertWatchSession(ownerWatched.getId(), "VALID", BASE_TIME);
        Cookie token = login(owner.getEmail());

        assertOrder(token, Map.of("sortBy", "viewCount", "sortDirection", "desc"),
                ownerWatched, ownerShared);
    }

    @Test
    void recentAndMostWatchedFormsUseSameFilteredLibraryEndpoint() throws Exception {
        Account owner = createAccount("library-modes@example.com");
        LibraryVideo olderOften = createVideo(owner, "mode-often", "Video", 100, BASE_TIME);
        LibraryVideo recentOnce = createVideo(owner, "mode-recent", "Video", 100, BASE_TIME.plusSeconds(1));
        createVideo(owner, "mode-unwatched", "Video", 100, BASE_TIME.plusSeconds(2));
        for (int index = 0; index < 3; index++) {
            insertWatchSession(olderOften.getId(), "VALID", BASE_TIME.plusDays(index));
        }
        insertWatchSession(recentOnce.getId(), "VALID", BASE_TIME.plusDays(10));
        Cookie token = login(owner.getEmail());

        assertOrder(token, Map.of(
                "watched", "true",
                "sortBy", "lastWatchedAt",
                "sortDirection", "desc"), recentOnce, olderOften);
        assertOrder(token, Map.of(
                "watched", "true",
                "sortBy", "viewCount",
                "sortDirection", "desc"), olderOften, recentOnce);
    }

    @Test
    void sortingCombinesWithEveryFilterAndKeepsPaginationStableAndReadOnly() throws Exception {
        Account owner = createAccount("combined-sort@example.com");
        Account other = createAccount("combined-sort-other@example.com");
        Tag study = createTag(owner, "Study", "study");
        LibraryVideo first = createVideo(owner, "combined-sort-1", "Study Guide", 120, BASE_TIME);
        LibraryVideo second = createVideo(owner, "combined-sort-2", "Study Guide", 120, BASE_TIME.plusSeconds(1));
        LibraryVideo third = createVideo(owner, "combined-sort-3", "Study Guide", 120, BASE_TIME.plusSeconds(2));
        LibraryVideo excluded = createVideo(owner, "combined-sort-excluded", "Other", 301, BASE_TIME.plusSeconds(3));
        LibraryVideo privateVideo = createVideo(
                other, "combined-sort-private", "Study Guide", 120, BASE_TIME.plusSeconds(4));
        for (LibraryVideo video : new LibraryVideo[] {first, second, third, excluded}) {
            insertRelation(video.getId(), study.getId());
            insertWatchSession(video.getId(), "VALID", BASE_TIME);
            insertNote(owner.getId(), video.getYoutubeSource().getId());
        }
        insertWatchSession(privateVideo.getId(), "VALID", BASE_TIME.plusDays(5));
        insertNote(other.getId(), privateVideo.getYoutubeSource().getId());
        Map<String, Long> countsBefore = tableCounts();
        OffsetDateTime updatedAtBefore = timestamp(
                "SELECT updated_at FROM library_videos WHERE id = ?", first.getId());
        Cookie token = login(owner.getEmail());

        Map<String, String> filters = new LinkedHashMap<>();
        filters.put("q", "study");
        filters.put("minDurationSeconds", "60");
        filters.put("maxDurationSeconds", "300");
        filters.put("publishedFrom", "2026-03-01");
        filters.put("publishedTo", "2026-03-31");
        filters.put("addedFrom", "2026-03-01");
        filters.put("addedTo", "2026-03-31");
        filters.put("tagId", study.getId().toString());
        filters.put("watched", "true");
        filters.put("hasNotes", "true");
        filters.put("sortBy", "viewCount");
        filters.put("sortDirection", "desc");

        var firstPage = get("/api/library/videos").cookie(token).queryParam("page", "0").queryParam("size", "2");
        filters.forEach(firstPage::queryParam);
        mockMvc.perform(firstPage)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(third.getId()))
                .andExpect(jsonPath("$.items[1].id").value(second.getId()))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));

        var secondPage = get("/api/library/videos").cookie(token).queryParam("page", "1").queryParam("size", "2");
        filters.forEach(secondPage::queryParam);
        mockMvc.perform(secondPage)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(first.getId()))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));

        assertThat(tableCounts()).isEqualTo(countsBefore);
        assertThat(timestamp("SELECT updated_at FROM library_videos WHERE id = ?", first.getId()))
                .isEqualTo(updatedAtBefore);
    }

    @Test
    void invalidAndBlankSortParametersReturnStandardValidationErrors() throws Exception {
        Account owner = createAccount("sort-validation@example.com");
        Cookie token = login(owner.getEmail());

        assertSortValidationError(token, "sortBy", "title", "sortBy");
        assertSortValidationError(token, "sortDirection", "up", "sortDirection");
        assertSortValidationError(token, "sortBy", "", "sortBy");
        assertSortValidationError(token, "sortDirection", "", "sortDirection");
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

    private void insertWatchSession(Long libraryVideoId, String status, OffsetDateTime startedAt) {
        jdbcTemplate.update("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, ?, ?, ?, 30, ?)
                """, libraryVideoId, startedAt, startedAt.plusMinutes(1), startedAt.plusMinutes(1), status);
    }

    private Long insertNote(Long accountId, Long youtubeSourceId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, 'Context', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId);
    }

    private void assertOrder(Cookie token, Map<String, String> parameters, LibraryVideo... expected)
            throws Exception {
        var request = get("/api/library/videos").cookie(token);
        parameters.forEach(request::queryParam);
        var actions = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(expected.length))
                .andExpect(jsonPath("$.totalElements").value(expected.length));
        for (int index = 0; index < expected.length; index++) {
            actions.andExpect(jsonPath("$.items[" + index + "].id").value(expected[index].getId()));
        }
    }

    private void assertSortValidationError(Cookie token, String parameter, String value, String field)
            throws Exception {
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
