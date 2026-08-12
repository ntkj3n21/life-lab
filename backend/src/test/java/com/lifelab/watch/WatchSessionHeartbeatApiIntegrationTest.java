package com.lifelab.watch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
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
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
import com.lifelab.video.repository.LibraryVideoRepository;
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
class WatchSessionHeartbeatApiIntegrationTest {

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
    void heartbeatRequiresAuthenticationAndCsrf() throws Exception {
        CsrfExchange guestCsrf = fetchCsrf();
        mockMvc.perform(post("/api/watch-sessions/{id}/heartbeat", 1L)
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playedSecondsDelta\":0}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("csrf-heartbeat", 60));
        Long sessionId = insertSession(video.getId(), null, 0, "PENDING", 30, 10);
        Cookie accessToken = login(owner.getEmail());
        mockMvc.perform(post("/api/watch-sessions/{id}/heartbeat", sessionId)
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playedSecondsDelta\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void unknownAndCrossAccountSessionsUseSameSafeNotFoundWithoutMutation() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        LibraryVideo otherVideo = createLibraryVideo(other, createSource("private-heartbeat", 60));
        Long otherSessionId = insertSession(otherVideo.getId(), null, 7, "PENDING", 30, 10);
        Map<String, Object> before = sessionRow(otherSessionId);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        for (Long id : new Long[] {Long.MAX_VALUE, otherSessionId}) {
            heartbeat(accessToken, csrf, id, "{\"playedSecondsDelta\":5}")
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("WATCH_SESSION_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("The watch session could not be found."));
        }

        assertThat(sessionRow(otherSessionId)).isEqualTo(before);
        assertThat(watchSessionRepository.count()).isOne();
    }

    @Test
    void zeroDeltaUpdatesLivenessButNotWatchTimeOrPendingStatus() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("zero-heartbeat", 60));
        Long sessionId = insertSession(video.getId(), null, 5, "PENDING", 60, 20);
        OffsetDateTime oldHeartbeat = queryTimestamp(
                "SELECT last_heartbeat_at FROM watch_sessions WHERE id = ?", sessionId);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        MvcResult result = heartbeat(accessToken, csrf, sessionId, "{\"playedSecondsDelta\":0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(5))
                .andExpect(jsonPath("$.validityStatus").value("PENDING"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        OffsetDateTime responseHeartbeat = OffsetDateTime.parse(body.get("lastHeartbeatAt").stringValue());
        Map<String, Object> persisted = sessionRow(sessionId);
        OffsetDateTime persistedHeartbeat = queryTimestamp(
                "SELECT last_heartbeat_at FROM watch_sessions WHERE id = ?", sessionId);
        assertThat((Integer) persisted.get("watch_time_seconds")).isEqualTo(5);
        assertThat((String) persisted.get("validity_status")).isEqualTo("PENDING");
        assertThat(persistedHeartbeat).isAfter(oldHeartbeat);
        assertThat(persistedHeartbeat)
                .isCloseTo(responseHeartbeat, within(1, ChronoUnit.MICROS));
    }

    @Test
    void legitimatePositiveDeltaPersistsAndResponseMatchesDatabase() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("positive-heartbeat", 60));
        Long sessionId = insertSession(video.getId(), null, 5, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        MvcResult result = heartbeat(accessToken, csrf, sessionId, "{\"playedSecondsDelta\":8}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(13))
                .andExpect(jsonPath("$.validityStatus").value("PENDING"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        Map<String, Object> persisted = sessionRow(sessionId);
        OffsetDateTime persistedHeartbeat = queryTimestamp(
                "SELECT last_heartbeat_at FROM watch_sessions WHERE id = ?", sessionId);
        assertThat((Integer) persisted.get("watch_time_seconds")).isEqualTo(13);
        assertThat((String) persisted.get("validity_status")).isEqualTo("PENDING");
        assertThat(persistedHeartbeat).isCloseTo(
                OffsetDateTime.parse(body.get("lastHeartbeatAt").stringValue()),
                within(1, ChronoUnit.MICROS));
    }

    @Test
    void knownDurationTransitionsFromPendingToValidAtThreshold() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("known-valid", 10));
        Long sessionId = insertSession(video.getId(), null, 5, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        heartbeat(accessToken, csrf, sessionId, "{\"playedSecondsDelta\":3}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(8))
                .andExpect(jsonPath("$.validityStatus").value("VALID"));

        assertThat(sessionRow(sessionId).get("validity_status")).isEqualTo("VALID");
    }

    @Test
    void unknownDurationTransitionsToValidAtThirtyTrustedSeconds() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("unknown-valid", null));
        Long sessionId = insertSession(video.getId(), null, 29, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        heartbeat(accessToken, csrf, sessionId, "{\"playedSecondsDelta\":1}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(30))
                .andExpect(jsonPath("$.validityStatus").value("VALID"));
    }

    @Test
    void closedSessionReturnsConflictWithoutMutation() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("closed-heartbeat", 60));
        OffsetDateTime endedAt = OffsetDateTime.now().minusSeconds(5);
        Long sessionId = insertSession(video.getId(), endedAt, 11, "INVALID", 60, 20);
        Map<String, Object> before = sessionRow(sessionId);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        heartbeat(accessToken, csrf, sessionId, "{\"playedSecondsDelta\":5}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WATCH_SESSION_CLOSED"));

        assertThat(sessionRow(sessionId)).isEqualTo(before);
    }

    @Test
    void missingAndNegativeDeltaFailValidation() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("validation-heartbeat", 60));
        Long sessionId = insertSession(video.getId(), null, 0, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        heartbeat(accessToken, csrf, sessionId, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.playedSecondsDelta").exists());
        heartbeat(accessToken, csrf, sessionId, "{\"playedSecondsDelta\":-1}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.playedSecondsDelta").exists());

        assertThat(sessionRow(sessionId).get("watch_time_seconds")).isEqualTo(0);
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
    }

    private YouTubeVideo createSource(String youtubeVideoId, Integer durationSeconds) {
        OffsetDateTime now = OffsetDateTime.now();
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                "Source title",
                "Source channel",
                "https://image.example/thumbnail.jpg",
                durationSeconds,
                OffsetDateTime.parse("2024-04-15T09:30:00Z"),
                YouTubeAvailabilityStatus.AVAILABLE,
                now));
    }

    private LibraryVideo createLibraryVideo(Account account, YouTubeVideo source) {
        return libraryVideoRepository.saveAndFlush(
                LibraryVideo.create(account, source, OffsetDateTime.now()));
    }

    private Long insertSession(
            Long libraryVideoId,
            OffsetDateTime endedAt,
            int watchTimeSeconds,
            String validityStatus,
            int startedSecondsAgo,
            int heartbeatSecondsAgo) {
        OffsetDateTime now = OffsetDateTime.now();
        return jdbcTemplate.queryForObject("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                libraryVideoId,
                now.minusSeconds(startedSecondsAgo),
                endedAt,
                now.minusSeconds(heartbeatSecondsAgo),
                watchTimeSeconds,
                validityStatus);
    }

    private Map<String, Object> sessionRow(Long sessionId) {
        return jdbcTemplate.queryForMap("""
                SELECT library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                FROM watch_sessions
                WHERE id = ?
                """, sessionId);
    }

    private OffsetDateTime queryTimestamp(String sql, Long id) {
        return jdbcTemplate.queryForObject(sql, OffsetDateTime.class, id);
    }

    private org.springframework.test.web.servlet.ResultActions heartbeat(
            Cookie accessToken,
            CsrfExchange csrf,
            Long sessionId,
            String body) throws Exception {
        return mockMvc.perform(post("/api/watch-sessions/{id}/heartbeat", sessionId)
                .cookie(accessToken, csrf.cookie())
                .header(csrf.headerName(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
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
