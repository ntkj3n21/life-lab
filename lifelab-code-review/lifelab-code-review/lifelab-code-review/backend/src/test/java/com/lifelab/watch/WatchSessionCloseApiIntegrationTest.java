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

import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "app.security.jwt.secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "app.security.cookie.secure=false"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class WatchSessionCloseApiIntegrationTest {

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
    void closeRequiresAuthenticationAndCsrf() throws Exception {
        CsrfExchange guestCsrf = fetchCsrf();
        close(null, guestCsrf, 1L, "{\"playedSecondsDelta\":0}")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("csrf-close", 60));
        Long sessionId = insertSession(video.getId(), null, 0, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());
        mockMvc.perform(post("/api/watch-sessions/{id}/close", sessionId)
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"playedSecondsDelta\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void unknownAndCrossAccountSessionsUseSafeNotFoundAndDoNotMutate() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        LibraryVideo otherVideo = createLibraryVideo(other, createSource("private-close", 60));
        Long otherSessionId = insertSession(otherVideo.getId(), null, 7, "PENDING", 60, 20);
        SessionState before = sessionState(otherSessionId);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        for (Long id : new Long[] {Long.MAX_VALUE, otherSessionId}) {
            close(accessToken, csrf, id, "{\"playedSecondsDelta\":1}")
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("WATCH_SESSION_NOT_FOUND"));
        }

        assertThat(sessionState(otherSessionId)).isEqualTo(before);
    }

    @Test
    void knownTenSecondDurationClosesValidAtEightAndInvalidAtSeven() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("known-ten", 10));
        Long validSession = insertSession(video.getId(), null, 7, "PENDING", 60, 20);
        Long invalidSession = insertSession(video.getId(), null, 7, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());

        close(accessToken, fetchCsrf(accessToken), validSession, "{\"playedSecondsDelta\":1}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(8))
                .andExpect(jsonPath("$.validityStatus").value("VALID"));
        close(accessToken, fetchCsrf(accessToken), invalidSession, "{\"playedSecondsDelta\":0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(7))
                .andExpect(jsonPath("$.validityStatus").value("INVALID"));
    }

    @Test
    void knownSixtySecondDurationClosesValidAtThirtyAndInvalidBelowThirty() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("known-sixty", 60));
        Long validSession = insertSession(video.getId(), null, 29, "PENDING", 60, 20);
        Long invalidSession = insertSession(video.getId(), null, 29, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());

        close(accessToken, fetchCsrf(accessToken), validSession, "{\"playedSecondsDelta\":1}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(30))
                .andExpect(jsonPath("$.validityStatus").value("VALID"));
        close(accessToken, fetchCsrf(accessToken), invalidSession, "{\"playedSecondsDelta\":0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(29))
                .andExpect(jsonPath("$.validityStatus").value("INVALID"));
    }

    @Test
    void unknownDurationClosesValidAtThirtyAndUndeterminedBelowThirty() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("unknown-close", null));
        Long validSession = insertSession(video.getId(), null, 29, "PENDING", 60, 20);
        Long undeterminedSession = insertSession(video.getId(), null, 29, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());

        close(accessToken, fetchCsrf(accessToken), validSession, "{\"playedSecondsDelta\":1}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(30))
                .andExpect(jsonPath("$.validityStatus").value("VALID"));
        close(accessToken, fetchCsrf(accessToken), undeterminedSession, "{\"playedSecondsDelta\":0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(29))
                .andExpect(jsonPath("$.validityStatus").value("UNDETERMINED"));
    }

    @Test
    void excessiveFinalDeltaIsCappedAndPersistedCloseStateMatchesResponse() throws Exception {
        Account owner = createAccount("owner@example.com");
        YouTubeVideo source = createSource("capped-close", 60);
        LibraryVideo video = createLibraryVideo(owner, source);
        OffsetDateTime libraryUpdatedAt = queryTimestamp(
                "SELECT updated_at FROM library_videos WHERE id = ?", video.getId());
        Long sessionId = insertSession(video.getId(), null, 0, "PENDING", 10, 10);
        OffsetDateTime startedAt = sessionState(sessionId).startedAt();
        String sourceUrl = source.getSourceUrl();
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);
        OffsetDateTime beforeRequest = OffsetDateTime.now();

        MvcResult result = close(accessToken, csrf, sessionId, "{\"playedSecondsDelta\":100}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(12))
                .andExpect(jsonPath("$.validityStatus").value("INVALID"))
                .andReturn();
        OffsetDateTime afterRequest = OffsetDateTime.now();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        OffsetDateTime responseEndedAt = OffsetDateTime.parse(body.get("endedAt").stringValue());
        OffsetDateTime responseHeartbeatAt = OffsetDateTime.parse(body.get("lastHeartbeatAt").stringValue());
        SessionState persisted = sessionState(sessionId);
        assertThat(responseEndedAt).isBetween(beforeRequest, afterRequest);
        assertThat(responseHeartbeatAt).isEqualTo(responseEndedAt);
        assertThat(persisted.watchTimeSeconds()).isEqualTo(12);
        assertThat(persisted.validityStatus()).isEqualTo("INVALID");
        assertThat(persisted.startedAt()).isEqualTo(startedAt);
        assertThat(persisted.endedAt()).isCloseTo(responseEndedAt, within(1, ChronoUnit.MICROS));
        assertThat(persisted.lastHeartbeatAt()).isEqualTo(persisted.endedAt());
        assertThat(queryTimestamp("SELECT updated_at FROM library_videos WHERE id = ?", video.getId()))
                .isEqualTo(libraryUpdatedAt);
        assertThat(youTubeVideoRepository.findById(source.getId()).orElseThrow().getSourceUrl())
                .isEqualTo(sourceUrl);
    }

    @Test
    void zeroDeltaClosesAndLaterCloseOrHeartbeatCannotMutateSession() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("closed-once", 60));
        Long sessionId = insertSession(video.getId(), null, 5, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());

        close(accessToken, fetchCsrf(accessToken), sessionId, "{\"playedSecondsDelta\":0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.endedAt").exists())
                .andExpect(jsonPath("$.watchTimeSeconds").value(5))
                .andExpect(jsonPath("$.validityStatus").value("INVALID"));
        SessionState closed = sessionState(sessionId);

        close(accessToken, fetchCsrf(accessToken), sessionId, "{\"playedSecondsDelta\":1}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WATCH_SESSION_CLOSED"));
        heartbeat(accessToken, fetchCsrf(accessToken), sessionId, 1)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WATCH_SESSION_CLOSED"));
        assertThat(sessionState(sessionId)).isEqualTo(closed);
    }

    @Test
    void activeValidSessionRemainsValidWhenClosedWithZeroDelta() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("valid-remains", 10));
        Long sessionId = insertSession(video.getId(), null, 8, "VALID", 60, 20);
        Cookie accessToken = login(owner.getEmail());

        close(accessToken, fetchCsrf(accessToken), sessionId, "{\"playedSecondsDelta\":0}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.watchTimeSeconds").value(8))
                .andExpect(jsonPath("$.validityStatus").value("VALID"));
    }

    @Test
    void alreadyClosedSessionReturnsConflictWithoutMutation() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("already-closed", 60));
        Long sessionId = insertSession(
                video.getId(), OffsetDateTime.now().minusSeconds(5), 7, "INVALID", 60, 20);
        SessionState before = sessionState(sessionId);
        Cookie accessToken = login(owner.getEmail());

        close(accessToken, fetchCsrf(accessToken), sessionId, "{\"playedSecondsDelta\":1}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WATCH_SESSION_CLOSED"));

        assertThat(sessionState(sessionId)).isEqualTo(before);
    }

    @Test
    void missingAndNegativeFinalDeltaFailValidation() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, createSource("validation-close", 60));
        Long sessionId = insertSession(video.getId(), null, 0, "PENDING", 60, 20);
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        close(accessToken, csrf, sessionId, "{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.playedSecondsDelta").exists());
        close(accessToken, csrf, sessionId, "{\"playedSecondsDelta\":-1}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.playedSecondsDelta").exists());
        assertThat(sessionState(sessionId).endedAt()).isNull();
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

    private SessionState sessionState(Long sessionId) {
        return jdbcTemplate.queryForObject("""
                SELECT started_at, ended_at, last_heartbeat_at, watch_time_seconds, validity_status
                FROM watch_sessions
                WHERE id = ?
                """,
                (resultSet, rowNumber) -> new SessionState(
                        resultSet.getObject("started_at", OffsetDateTime.class),
                        resultSet.getObject("ended_at", OffsetDateTime.class),
                        resultSet.getObject("last_heartbeat_at", OffsetDateTime.class),
                        resultSet.getInt("watch_time_seconds"),
                        resultSet.getString("validity_status")),
                sessionId);
    }

    private OffsetDateTime queryTimestamp(String sql, Long id) {
        return jdbcTemplate.queryForObject(sql, OffsetDateTime.class, id);
    }

    private org.springframework.test.web.servlet.ResultActions close(
            Cookie accessToken,
            CsrfExchange csrf,
            Long sessionId,
            String body) throws Exception {
        var request = post("/api/watch-sessions/{id}/close", sessionId)
                .header(csrf.headerName(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
        if (accessToken == null) {
            request.cookie(csrf.cookie());
        } else {
            request.cookie(accessToken, csrf.cookie());
        }
        return mockMvc.perform(request);
    }

    private org.springframework.test.web.servlet.ResultActions heartbeat(
            Cookie accessToken,
            CsrfExchange csrf,
            Long sessionId,
            int delta) throws Exception {
        return mockMvc.perform(post("/api/watch-sessions/{id}/heartbeat", sessionId)
                .cookie(accessToken, csrf.cookie())
                .header(csrf.headerName(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"playedSecondsDelta\":%d}".formatted(delta)));
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

    private record SessionState(
            OffsetDateTime startedAt,
            OffsetDateTime endedAt,
            OffsetDateTime lastHeartbeatAt,
            int watchTimeSeconds,
            String validityStatus) {
    }
}
