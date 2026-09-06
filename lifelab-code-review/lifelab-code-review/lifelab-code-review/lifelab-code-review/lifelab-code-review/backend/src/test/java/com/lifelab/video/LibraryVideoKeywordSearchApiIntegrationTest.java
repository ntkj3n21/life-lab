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
class LibraryVideoKeywordSearchApiIntegrationTest {

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
    void keywordSearchRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/library/videos").queryParam("q", "study"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void absentAndBlankQueryKeepExistingDefaultsAndOrdering() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        OffsetDateTime oldTime = OffsetDateTime.parse("2024-01-01T00:00:00Z");
        OffsetDateTime recentTime = OffsetDateTime.parse("2024-02-01T00:00:00Z");
        LibraryVideo oldVideo = createVideo(owner, "no-q-old", "Old", null, null, null, oldTime);
        LibraryVideo recentLowerId = createVideo(
                owner, "no-q-recent-1", "Recent one", null, null, null, recentTime);
        LibraryVideo recentHigherId = createVideo(
                owner, "no-q-recent-2", "Recent two", null, null, null, recentTime);
        createVideo(other, "no-q-other", "Other", null, null, null, recentTime.plusDays(1));
        Cookie accessToken = login(owner.getEmail());

        for (String query : new String[] {null, "   \t  "}) {
            var request = get("/api/library/videos").cookie(accessToken);
            if (query != null) {
                request.queryParam("q", query);
            }
            mockMvc.perform(request)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.page").value(0))
                    .andExpect(jsonPath("$.size").value(20))
                    .andExpect(jsonPath("$.totalElements").value(3))
                    .andExpect(jsonPath("$.items[0].id").value(recentHigherId.getId()))
                    .andExpect(jsonPath("$.items[1].id").value(recentLowerId.getId()))
                    .andExpect(jsonPath("$.items[2].id").value(oldVideo.getId()));
        }
    }

    @Test
    void searchesEachSupportedSourcePersonalAndTagField() throws Exception {
        Account owner = createAccount("owner@example.com");
        OffsetDateTime time = OffsetDateTime.parse("2024-01-01T00:00:00Z");
        LibraryVideo titleVideo = createVideo(
                owner, "field-title", "Quantum Gardens", "Channel A", null, null, time);
        LibraryVideo channelVideo = createVideo(
                owner, "field-channel", "Title B", "Astronomy Workshop", null, null, time.plusSeconds(1));
        LibraryVideo customVideo = createVideo(
                owner, "field-custom", "Title C", "Channel C", "Personal Focus", null, time.plusSeconds(2));
        LibraryVideo descriptionVideo = createVideo(
                owner, "field-description", "Title D", "Channel D", null,
                "Review distributed systems", time.plusSeconds(3));
        LibraryVideo tagVideo = createVideo(
                owner, "field-tag", "Title E", "Channel E", null, null, time.plusSeconds(4));
        Tag tag = createTag(owner, "Deep Learning", "deep learning");
        insertRelation(tagVideo.getId(), tag.getId());
        Cookie accessToken = login(owner.getEmail());

        assertSingleMatch(accessToken, "quantum", titleVideo.getId());
        assertSingleMatch(accessToken, "astronomy", channelVideo.getId());
        assertSingleMatch(accessToken, "focus", customVideo.getId());
        assertSingleMatch(accessToken, "distributed", descriptionVideo.getId());
        assertSingleMatch(accessToken, "learning", tagVideo.getId());
    }

    @Test
    void searchIsCaseInsensitiveTrimsOuterWhitespaceAndMatchesPartialSubstring() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createVideo(
                owner,
                "semantic-study",
                "Advanced Study Techniques",
                null,
                null,
                null,
                OffsetDateTime.now());
        Cookie accessToken = login(owner.getEmail());

        assertSingleMatch(accessToken, "  sTuDy  ", video.getId());
        assertSingleMatch(accessToken, "udy Tech", video.getId());
    }

    @Test
    void nonmatchingAndCrossAccountDataProduceEmptyScopedPage() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        createVideo(owner, "owner-unmatched", "Cooking", null, null, null, OffsetDateTime.now());
        createVideo(other, "other-matching", "Private Study", null, null, null, OffsetDateTime.now());
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("q", "study")
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0));
    }

    @Test
    void multiFieldAndMultiTagMatchesStayDistinctWithDatabasePaginationAndNoMutation() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        OffsetDateTime base = OffsetDateTime.parse("2024-01-01T00:00:00Z");
        LibraryVideo multiMatch = createVideo(
                owner,
                "multi-study",
                "Study Source",
                "Study Channel",
                "Study Custom",
                "Study Description",
                base);
        LibraryVideo secondMatch = createVideo(
                owner, "second-study", "Other", null, "Study Plan", null, base.plusSeconds(1));
        LibraryVideo thirdMatch = createVideo(
                owner, "third-study", "Other", null, null, null, base.plusSeconds(2));
        Tag study = createTag(owner, "Study", "study");
        Tag studyAid = createTag(owner, "Study Aid", "study aid");
        insertRelation(multiMatch.getId(), study.getId());
        insertRelation(multiMatch.getId(), studyAid.getId());
        insertRelation(thirdMatch.getId(), study.getId());
        createVideo(other, "other-study", "Study Private", null, null, null, base.plusSeconds(3));
        insertWatchSession(multiMatch.getId());
        Long noteId = insertNote(owner.getId(), multiMatch.getYoutubeSource().getId());
        insertTask(owner.getId(), noteId);
        Map<String, Long> countsBefore = tableCounts();
        OffsetDateTime videoUpdatedAt = queryTimestamp(
                "SELECT updated_at FROM library_videos WHERE id = ?", multiMatch.getId());
        OffsetDateTime sourceUpdatedAt = queryTimestamp(
                "SELECT updated_at FROM youtube_videos WHERE id = ?", multiMatch.getYoutubeSource().getId());
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("q", "study")
                        .queryParam("page", "0")
                        .queryParam("size", "2")
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(thirdMatch.getId()))
                .andExpect(jsonPath("$.items[1].id").value(secondMatch.getId()))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/library/videos")
                        .queryParam("q", "study")
                        .queryParam("page", "1")
                        .queryParam("size", "2")
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(multiMatch.getId()))
                .andExpect(jsonPath("$.totalElements").value(3));

        assertThat(tableCounts()).isEqualTo(countsBefore);
        assertThat(queryTimestamp("SELECT updated_at FROM library_videos WHERE id = ?", multiMatch.getId()))
                .isEqualTo(videoUpdatedAt);
        assertThat(queryTimestamp(
                "SELECT updated_at FROM youtube_videos WHERE id = ?", multiMatch.getYoutubeSource().getId()))
                .isEqualTo(sourceUpdatedAt);
    }

    private void assertSingleMatch(Cookie accessToken, String query, Long expectedId) throws Exception {
        mockMvc.perform(get("/api/library/videos")
                        .queryParam("q", query)
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(expectedId))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
    }

    private LibraryVideo createVideo(
            Account account,
            String youtubeVideoId,
            String sourceTitle,
            String channelName,
            String customTitle,
            String personalDescription,
            OffsetDateTime addedAt) {
        YouTubeVideo source = youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                sourceTitle,
                channelName,
                "https://image.example/" + youtubeVideoId + ".jpg",
                321,
                OffsetDateTime.parse("2023-04-15T09:30:00Z"),
                YouTubeAvailabilityStatus.AVAILABLE,
                addedAt));
        LibraryVideo video = LibraryVideo.create(account, source, addedAt);
        if (customTitle != null || personalDescription != null) {
            video.updatePersonalInfo(customTitle, personalDescription, addedAt);
        }
        return libraryVideoRepository.saveAndFlush(video);
    }

    private Tag createTag(Account account, String name, String normalizedName) {
        return tagRepository.saveAndFlush(Tag.create(
                account,
                name,
                normalizedName,
                OffsetDateTime.now()));
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

    private Map<String, Long> tableCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : new String[] {
                "accounts", "youtube_videos", "library_videos", "tags",
                "library_video_tags", "watch_sessions", "notes", "tasks"}) {
            counts.put(table, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class));
        }
        return counts;
    }

    private OffsetDateTime queryTimestamp(String sql, Long id) {
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
