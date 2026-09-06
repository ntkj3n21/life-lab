package com.lifelab.watch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;

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
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
import com.lifelab.video.repository.LibraryVideoRepository;
import com.lifelab.video.repository.YouTubeVideoRepository;
import com.lifelab.watch.domain.WatchSession;
import com.lifelab.watch.domain.WatchSessionValidityStatus;
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
class WatchSessionStartApiIntegrationTest {

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
    void unauthenticatedStartReturnsUnauthenticated() throws Exception {
        CsrfExchange guestCsrf = fetchCsrf();

        mockMvc.perform(post("/api/library/videos/{id}/watch-sessions", 1L)
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        assertThat(watchSessionRepository.count()).isZero();
    }

    @Test
    void authenticatedStartRequiresCsrf() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("csrf-start"));
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(post("/api/library/videos/{id}/watch-sessions", video.getId())
                        .cookie(accessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        assertThat(watchSessionRepository.count()).isZero();
    }

    @Test
    void ownerStartsServerInitializedPendingSessionWithoutUnrelatedMutation() throws Exception {
        Account owner = createAccount("owner@example.com");
        YouTubeVideo source = createSource("owned-start");
        LibraryVideo video = createLibraryVideo(owner, source);
        video.updatePersonalInfo("Personal title", "Personal description", OffsetDateTime.now());
        libraryVideoRepository.saveAndFlush(video);
        OffsetDateTime libraryAddedAt = queryTimestamp(
                "SELECT added_at FROM library_videos WHERE id = ?", video.getId());
        OffsetDateTime libraryUpdatedAt = queryTimestamp(
                "SELECT updated_at FROM library_videos WHERE id = ?", video.getId());
        String sourceTitle = source.getTitle();
        String sourceUrl = source.getSourceUrl();
        OffsetDateTime beforeRequest = OffsetDateTime.now();
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        MvcResult result = mockMvc.perform(post("/api/library/videos/{id}/watch-sessions", video.getId())
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.libraryVideoId").value(video.getId()))
                .andExpect(jsonPath("$.endedAt").doesNotExist())
                .andExpect(jsonPath("$.watchTimeSeconds").value(0))
                .andExpect(jsonPath("$.validityStatus").value("PENDING"))
                .andExpect(jsonPath("$.account").doesNotExist())
                .andExpect(jsonPath("$.accountId").doesNotExist())
                .andReturn();
        OffsetDateTime afterRequest = OffsetDateTime.now();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        OffsetDateTime startedAt = OffsetDateTime.parse(body.get("startedAt").stringValue());
        OffsetDateTime lastHeartbeatAt = OffsetDateTime.parse(body.get("lastHeartbeatAt").stringValue());
        assertThat(startedAt).isBetween(beforeRequest, afterRequest);
        assertThat(lastHeartbeatAt).isEqualTo(startedAt);
        assertThat(watchSessionRepository.count()).isOne();
        WatchSession persisted = watchSessionRepository.findAll().get(0);
        assertThat(persisted.getId()).isEqualTo(body.get("id").longValue());
        assertThat(persisted.getLibraryVideo().getId()).isEqualTo(video.getId());
        assertThat(persisted.getStartedAt()).isCloseTo(startedAt, within(1, ChronoUnit.MICROS));
        assertThat(persisted.getLastHeartbeatAt()).isEqualTo(persisted.getStartedAt());
        assertThat(persisted.getEndedAt()).isNull();
        assertThat(persisted.getWatchTimeSeconds()).isZero();
        assertThat(persisted.getValidityStatus()).isEqualTo(WatchSessionValidityStatus.PENDING);

        LibraryVideo persistedVideo = libraryVideoRepository
                .findByIdAndAccount_Id(video.getId(), owner.getId()).orElseThrow();
        YouTubeVideo persistedSource = youTubeVideoRepository.findById(source.getId()).orElseThrow();
        assertThat(persistedVideo.getCustomTitle()).isEqualTo("Personal title");
        assertThat(persistedVideo.getPersonalDescription()).isEqualTo("Personal description");
        assertThat(persistedVideo.getAddedAt()).isEqualTo(libraryAddedAt);
        assertThat(persistedVideo.getUpdatedAt()).isEqualTo(libraryUpdatedAt);
        assertThat(persistedSource.getTitle()).isEqualTo(sourceTitle);
        assertThat(persistedSource.getSourceUrl()).isEqualTo(sourceUrl);
        assertThat(countRows("notes")).isZero();
        assertThat(countRows("tasks")).isZero();
        assertThat(countRows("tags")).isZero();
    }

    @Test
    void unknownLibraryVideoReturnsSafeNotFoundWithoutCreatingSession() throws Exception {
        Account owner = createAccount("owner@example.com");
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        mockMvc.perform(post("/api/library/videos/{id}/watch-sessions", Long.MAX_VALUE)
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));

        assertThat(watchSessionRepository.count()).isZero();
    }

    @Test
    void crossAccountLibraryVideoUsesSameSafeNotFoundAndCreatesNoSession() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        LibraryVideo otherVideo = createLibraryVideo(other, createSource("private-start"));
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        mockMvc.perform(post("/api/library/videos/{id}/watch-sessions", otherVideo.getId())
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("The library video could not be found."));

        assertThat(watchSessionRepository.count()).isZero();
        assertThat(libraryVideoRepository.findById(otherVideo.getId())).isPresent();
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

    private long countRows(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
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
