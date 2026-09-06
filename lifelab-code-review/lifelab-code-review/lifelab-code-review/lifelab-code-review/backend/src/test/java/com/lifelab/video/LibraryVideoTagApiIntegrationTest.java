package com.lifelab.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;

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
class LibraryVideoTagApiIntegrationTest {

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
    void allEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/library/videos/{videoId}/tags", 1L))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        CsrfExchange guestCsrf = fetchCsrf();
        mockMvc.perform(put("/api/library/videos/{videoId}/tags/{tagId}", 1L, 1L)
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(delete("/api/library/videos/{videoId}/tags/{tagId}", 1L, 1L)
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void attachAndDetachRequireCsrf() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("csrf-tags"));
        Tag tag = createTag(owner, "Study", "study");
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(put("/api/library/videos/{videoId}/tags/{tagId}", video.getId(), tag.getId())
                        .cookie(accessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        mockMvc.perform(delete("/api/library/videos/{videoId}/tags/{tagId}", video.getId(), tag.getId())
                        .cookie(accessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(relationCount(video.getId(), tag.getId())).isZero();
    }

    @Test
    void attachSupportsManyToManyAndIsIdempotent() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo firstVideo = createLibraryVideo(owner, createSource("many-first"));
        LibraryVideo secondVideo = createLibraryVideo(owner, createSource("many-second"));
        Tag study = createTag(owner, "Study", "study");
        Tag work = createTag(owner, "Work", "work");
        Cookie accessToken = login(owner.getEmail());

        attach(accessToken, fetchCsrf(accessToken), firstVideo.getId(), study.getId())
                .andExpect(status().isNoContent());
        attach(accessToken, fetchCsrf(accessToken), firstVideo.getId(), work.getId())
                .andExpect(status().isNoContent());
        attach(accessToken, fetchCsrf(accessToken), secondVideo.getId(), study.getId())
                .andExpect(status().isNoContent());
        attach(accessToken, fetchCsrf(accessToken), firstVideo.getId(), study.getId())
                .andExpect(status().isNoContent());

        assertThat(relationCount(firstVideo.getId(), study.getId())).isOne();
        assertThat(relationCount(firstVideo.getId(), work.getId())).isOne();
        assertThat(relationCount(secondVideo.getId(), study.getId())).isOne();
        assertThat(countRows("library_video_tags")).isEqualTo(3);
    }

    @Test
    void getVideoTagsReturnsOnlyAttachedTagsInDeterministicArrayOrder() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("list-tags"));
        Tag zeta = createTag(owner, "zeta", "zeta");
        Tag alpha = createTag(owner, "Alpha", "alpha");
        Tag beta = createTag(owner, "beta", "beta");
        createTag(owner, "Aardvark", "aardvark");
        insertRelation(video.getId(), zeta.getId());
        insertRelation(video.getId(), alpha.getId());
        insertRelation(video.getId(), beta.getId());
        Cookie accessToken = login(owner.getEmail());

        MvcResult result = mockMvc.perform(get("/api/library/videos/{videoId}/tags", video.getId())
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(alpha.getId()))
                .andExpect(jsonPath("$[1].id").value(beta.getId()))
                .andExpect(jsonPath("$[2].id").value(zeta.getId()))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        assertThat(body.toString()).doesNotContain(
                "normalizedName", "accountId", "\"account\"");
    }

    @Test
    void libraryVideoOwnershipFailuresAreSafeAndDoNotChangeRelations() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        Tag ownerTag = createTag(owner, "Owner", "owner");
        LibraryVideo otherVideo = createLibraryVideo(other, createSource("private-video-tags"));
        Tag otherTag = createTag(other, "Other", "other");
        insertRelation(otherVideo.getId(), otherTag.getId());
        Cookie accessToken = login(owner.getEmail());

        for (Long videoId : new Long[] {Long.MAX_VALUE, otherVideo.getId()}) {
            attach(accessToken, fetchCsrf(accessToken), videoId, ownerTag.getId())
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));
            detach(accessToken, fetchCsrf(accessToken), videoId, ownerTag.getId())
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));
            mockMvc.perform(get("/api/library/videos/{videoId}/tags", videoId).cookie(accessToken))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));
        }
        assertThat(countRows("library_video_tags")).isOne();
        assertThat(relationCount(otherVideo.getId(), otherTag.getId())).isOne();
    }

    @Test
    void tagOwnershipFailuresAreSafeAndDoNotChangeRelations() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        LibraryVideo ownerVideo = createLibraryVideo(owner, createSource("private-tag-video"));
        Tag otherTag = createTag(other, "Private", "private");
        Cookie accessToken = login(owner.getEmail());

        for (Long tagId : new Long[] {Long.MAX_VALUE, otherTag.getId()}) {
            attach(accessToken, fetchCsrf(accessToken), ownerVideo.getId(), tagId)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));
            detach(accessToken, fetchCsrf(accessToken), ownerVideo.getId(), tagId)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));
        }
        assertThat(countRows("library_video_tags")).isZero();
        assertThat(tagRepository.findById(otherTag.getId())).isPresent();
    }

    @Test
    void detachIsIdempotentAndPreservesTagVideoSourceAndUnrelatedData() throws Exception {
        Account owner = createAccount("owner@example.com");
        YouTubeVideo source = createSource("detach-tags");
        LibraryVideo video = createLibraryVideo(owner, source);
        Tag tag = createTag(owner, "Keep", "keep");
        insertRelation(video.getId(), tag.getId());
        String sourceTitle = source.getTitle();
        String sourceUrl = source.getSourceUrl();
        Cookie accessToken = login(owner.getEmail());

        detach(accessToken, fetchCsrf(accessToken), video.getId(), tag.getId())
                .andExpect(status().isNoContent());
        detach(accessToken, fetchCsrf(accessToken), video.getId(), tag.getId())
                .andExpect(status().isNoContent());

        assertThat(relationCount(video.getId(), tag.getId())).isZero();
        assertThat(tagRepository.findById(tag.getId())).isPresent();
        assertThat(libraryVideoRepository.findById(video.getId())).isPresent();
        YouTubeVideo persistedSource = youTubeVideoRepository.findById(source.getId()).orElseThrow();
        assertThat(persistedSource.getTitle()).isEqualTo(sourceTitle);
        assertThat(persistedSource.getSourceUrl()).isEqualTo(sourceUrl);
        assertThat(countRows("watch_sessions")).isZero();
        assertThat(countRows("notes")).isZero();
        assertThat(countRows("tasks")).isZero();
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

    private long relationCount(Long libraryVideoId, Long tagId) {
        return jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM library_video_tags
                WHERE library_video_id = ? AND tag_id = ?
                """, Long.class, libraryVideoId, tagId);
    }

    private long countRows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
    }

    private org.springframework.test.web.servlet.ResultActions attach(
            Cookie accessToken,
            CsrfExchange csrf,
            Long libraryVideoId,
            Long tagId) throws Exception {
        return mockMvc.perform(put("/api/library/videos/{videoId}/tags/{tagId}", libraryVideoId, tagId)
                .cookie(accessToken, csrf.cookie())
                .header(csrf.headerName(), csrf.token()));
    }

    private org.springframework.test.web.servlet.ResultActions detach(
            Cookie accessToken,
            CsrfExchange csrf,
            Long libraryVideoId,
            Long tagId) throws Exception {
        return mockMvc.perform(delete("/api/library/videos/{videoId}/tags/{tagId}", libraryVideoId, tagId)
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
