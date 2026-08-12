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
class TagDeleteApiIntegrationTest {

    private static final String PASSWORD = "Password123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private YouTubeVideoRepository youTubeVideoRepository;

    @Autowired
    private LibraryVideoRepository libraryVideoRepository;

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
        mockMvc.perform(get("/api/tags/{id}/delete-impact", 1L))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        CsrfExchange guestCsrf = fetchCsrf();
        mockMvc.perform(delete("/api/tags/{id}", 1L)
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void deleteRequiresCsrf() throws Exception {
        Account owner = createAccount("owner@example.com");
        Tag tag = createTag(owner, "Keep", "keep");
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(delete("/api/tags/{id}", tag.getId()).cookie(accessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        assertThat(tagRepository.findById(tag.getId())).isPresent();
    }

    @Test
    void impactReportsZeroForUnusedTagWithoutMutation() throws Exception {
        Account owner = createAccount("owner@example.com");
        Tag tag = createTag(owner, "Unused", "unused");
        Map<String, Long> before = tableCounts();
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(get("/api/tags/{id}/delete-impact", tag.getId()).cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tagId").value(tag.getId()))
                .andExpect(jsonPath("$.libraryVideoCountToDetach").value(0))
                .andExpect(jsonPath("$.libraryVideosPreserved").value(true));

        assertThat(tableCounts()).isEqualTo(before);
    }

    @Test
    void impactCountsAllAttachedVideosWithoutMutation() throws Exception {
        Account owner = createAccount("owner@example.com");
        Tag tag = createTag(owner, "Used", "used");
        LibraryVideo first = createLibraryVideo(owner, createSource("impact-first"));
        LibraryVideo second = createLibraryVideo(owner, createSource("impact-second"));
        insertRelation(first.getId(), tag.getId());
        insertRelation(second.getId(), tag.getId());
        Map<String, Long> before = tableCounts();
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(get("/api/tags/{id}/delete-impact", tag.getId()).cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.libraryVideoCountToDetach").value(2))
                .andExpect(jsonPath("$.libraryVideosPreserved").value(true));

        assertThat(tableCounts()).isEqualTo(before);
    }

    @Test
    void unknownAndCrossAccountImpactAndDeleteUseSafeNotFoundWithoutMutation() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        Tag otherTag = createTag(other, "Private", "private");
        LibraryVideo otherVideo = createLibraryVideo(other, createSource("private-tag-delete"));
        insertRelation(otherVideo.getId(), otherTag.getId());
        Map<String, Long> before = tableCounts();
        Cookie accessToken = login(owner.getEmail());

        for (Long tagId : new Long[] {Long.MAX_VALUE, otherTag.getId()}) {
            mockMvc.perform(get("/api/tags/{id}/delete-impact", tagId).cookie(accessToken))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));
            deleteTag(accessToken, fetchCsrf(accessToken), tagId)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));
        }

        assertThat(tableCounts()).isEqualTo(before);
        assertThat(tagRepository.findById(otherTag.getId())).isPresent();
        assertThat(relationCount(otherVideo.getId(), otherTag.getId())).isOne();
    }

    @Test
    void deletingUnusedOwnedTagRemovesItAndListNoLongerContainsIt() throws Exception {
        Account owner = createAccount("owner@example.com");
        Tag deletedTag = createTag(owner, "Delete", "delete");
        Tag retainedTag = createTag(owner, "Retain", "retain");
        Cookie accessToken = login(owner.getEmail());

        deleteTag(accessToken, fetchCsrf(accessToken), deletedTag.getId())
                .andExpect(status().isNoContent());

        assertThat(tagRepository.findById(deletedTag.getId())).isEmpty();
        mockMvc.perform(get("/api/tags").cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(retainedTag.getId()));
    }

    @Test
    void deletingAttachedTagCascadesOnlyItsRelationsAndPreservesAllContext() throws Exception {
        Account owner = createAccount("owner@example.com");
        YouTubeVideo firstSource = createSource("delete-used-first");
        YouTubeVideo secondSource = createSource("delete-used-second");
        LibraryVideo firstVideo = createLibraryVideo(owner, firstSource);
        LibraryVideo secondVideo = createLibraryVideo(owner, secondSource);
        Tag deletedTag = createTag(owner, "Delete", "delete");
        Tag retainedTag = createTag(owner, "Retain", "retain");
        insertRelation(firstVideo.getId(), deletedTag.getId());
        insertRelation(secondVideo.getId(), deletedTag.getId());
        insertRelation(firstVideo.getId(), retainedTag.getId());
        insertWatchSession(firstVideo.getId());
        Long noteId = insertNote(owner.getId(), firstSource.getId());
        Long taskId = insertTask(owner.getId(), noteId);
        String sourceTitle = firstSource.getTitle();
        String sourceUrl = firstSource.getSourceUrl();
        Cookie accessToken = login(owner.getEmail());

        deleteTag(accessToken, fetchCsrf(accessToken), deletedTag.getId())
                .andExpect(status().isNoContent());

        assertThat(tagRepository.findById(deletedTag.getId())).isEmpty();
        assertThat(tagRepository.findById(retainedTag.getId())).isPresent();
        assertThat(countRelationsForTag(deletedTag.getId())).isZero();
        assertThat(relationCount(firstVideo.getId(), retainedTag.getId())).isOne();
        assertThat(libraryVideoRepository.findById(firstVideo.getId())).isPresent();
        assertThat(libraryVideoRepository.findById(secondVideo.getId())).isPresent();
        assertThat(youTubeVideoRepository.findById(firstSource.getId())).isPresent();
        assertThat(youTubeVideoRepository.findById(secondSource.getId())).isPresent();
        YouTubeVideo persistedSource = youTubeVideoRepository.findById(firstSource.getId()).orElseThrow();
        assertThat(persistedSource.getTitle()).isEqualTo(sourceTitle);
        assertThat(persistedSource.getSourceUrl()).isEqualTo(sourceUrl);
        assertThat(countRows("watch_sessions")).isOne();
        assertThat(countById("notes", noteId)).isOne();
        assertThat(countById("tasks", taskId)).isOne();
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
    }

    private Tag createTag(Account account, String name, String normalizedName) {
        return tagRepository.saveAndFlush(Tag.create(
                account,
                name,
                normalizedName,
                OffsetDateTime.now()));
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

    private Long insertTask(Long accountId, Long noteId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, ?, 'HAS_SOURCE', 'Task', NULL, 'NOT_STARTED', NULL,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, noteId);
    }

    private Map<String, Long> tableCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : new String[] {
                "accounts", "youtube_videos", "library_videos", "tags",
                "library_video_tags", "watch_sessions", "notes", "tasks"}) {
            counts.put(table, countRows(table));
        }
        return counts;
    }

    private long relationCount(Long libraryVideoId, Long tagId) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM library_video_tags
                WHERE library_video_id = ? AND tag_id = ?
                """, Long.class, libraryVideoId, tagId);
    }

    private long countRelationsForTag(Long tagId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM library_video_tags WHERE tag_id = ?",
                Long.class,
                tagId);
    }

    private long countRows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
    }

    private long countById(String table, Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE id = ?",
                Long.class,
                id);
    }

    private org.springframework.test.web.servlet.ResultActions deleteTag(
            Cookie accessToken,
            CsrfExchange csrf,
            Long tagId) throws Exception {
        return mockMvc.perform(delete("/api/tags/{id}", tagId)
                .cookie(accessToken, csrf.cookie())
                .header(csrf.headerName(), csrf.token()));
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
