package com.lifelab.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

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
class LibraryVideoNeighborsApiIntegrationTest {

    private static final String PASSWORD = "Password123";
    private static final OffsetDateTime BASE_TIME =
            OffsetDateTime.parse("2026-03-15T12:00:00Z");

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
    void defaultNeighborsCrossDisplayPageBoundariesAndExposeTrueBoundaries() throws Exception {
        Account owner = createAccount("neighbors-default@example.com");
        List<LibraryVideo> videos = new ArrayList<>();
        for (int index = 0; index < 25; index++) {
            videos.add(createVideo(
                    owner,
                    "neighbors-default-" + index,
                    "Video " + index,
                    100 + index,
                    BASE_TIME.plusSeconds(index)));
        }
        Cookie token = login(owner.getEmail());

        LibraryVideo pageZeroLast = videos.get(5);
        LibraryVideo pageOneFirst = videos.get(4);
        mockMvc.perform(get("/api/library/videos")
                        .queryParam("page", "0")
                        .queryParam("size", "20")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[19].id").value(pageZeroLast.getId()));
        mockMvc.perform(get("/api/library/videos")
                        .queryParam("page", "1")
                        .queryParam("size", "20")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(pageOneFirst.getId()));

        assertNeighbors(token, pageZeroLast, videos.get(6), pageOneFirst);
        assertNeighbors(token, videos.get(24), null, videos.get(23));
        assertNeighbors(token, videos.get(0), videos.get(1), null);
    }

    @Test
    void neighborsPreserveSearchAndFilterMembershipAndRejectAMissingTarget() throws Exception {
        Account owner = createAccount("neighbors-filter@example.com");
        LibraryVideo first = createVideo(
                owner, "neighbors-filter-1", "Study SQL", 120, BASE_TIME);
        LibraryVideo second = createVideo(
                owner, "neighbors-filter-2", "Study Java", 140, BASE_TIME.plusSeconds(1));
        LibraryVideo third = createVideo(
                owner, "neighbors-filter-3", "Study React", 160, BASE_TIME.plusSeconds(2));
        LibraryVideo wrongKeyword = createVideo(
                owner, "neighbors-filter-4", "Cooking", 150, BASE_TIME.plusSeconds(3));
        createVideo(owner, "neighbors-filter-5", "Study Too Long", 500, BASE_TIME.plusSeconds(4));
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos/{id}/neighbors", second.getId())
                        .queryParam("q", "study")
                        .queryParam("minDurationSeconds", "100")
                        .queryParam("maxDurationSeconds", "200")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previous.id").value(third.getId()))
                .andExpect(jsonPath("$.next.id").value(first.getId()));

        mockMvc.perform(get("/api/library/videos/{id}/neighbors", wrongKeyword.getId())
                        .queryParam("q", "study")
                        .queryParam("minDurationSeconds", "100")
                        .queryParam("maxDurationSeconds", "200")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.previous").doesNotExist())
                .andExpect(jsonPath("$.next").doesNotExist());
    }

    @Test
    void durationNeighborsKeepTieBreakAndNullsLastInBothDirections() throws Exception {
        Account owner = createAccount("neighbors-duration@example.com");
        LibraryVideo firstHundred = createVideo(
                owner, "neighbors-duration-1", "First", 100, BASE_TIME);
        LibraryVideo secondHundred = createVideo(
                owner, "neighbors-duration-2", "Second", 100, BASE_TIME.plusSeconds(1));
        LibraryVideo twoHundred = createVideo(
                owner, "neighbors-duration-3", "Third", 200, BASE_TIME.plusSeconds(2));
        LibraryVideo unknown = createVideo(
                owner, "neighbors-duration-4", "Unknown", null, BASE_TIME.plusSeconds(3));
        Cookie token = login(owner.getEmail());

        assertNeighbors(
                token,
                secondHundred,
                firstHundred,
                twoHundred,
                "duration",
                "asc");
        assertNeighbors(token, unknown, twoHundred, null, "duration", "asc");
        assertNeighbors(
                token,
                secondHundred,
                twoHundred,
                firstHundred,
                "duration",
                "desc");
        assertNeighbors(token, unknown, firstHundred, null, "duration", "desc");
    }

    @Test
    void watchDerivedNeighborsUseValidSessionsAndKeepUnwatchedLast() throws Exception {
        Account owner = createAccount("neighbors-watch@example.com");
        LibraryVideo often = createVideo(
                owner, "neighbors-watch-often", "Often", 100, BASE_TIME);
        LibraryVideo recent = createVideo(
                owner, "neighbors-watch-recent", "Recent", 100, BASE_TIME.plusSeconds(1));
        LibraryVideo unwatched = createVideo(
                owner, "neighbors-watch-none", "None", 100, BASE_TIME.plusSeconds(2));
        insertValidSession(often, BASE_TIME.plusDays(1));
        insertValidSession(often, BASE_TIME.plusDays(2));
        insertValidSession(often, BASE_TIME.plusDays(3));
        insertValidSession(recent, BASE_TIME.plusDays(10));
        Cookie token = login(owner.getEmail());

        assertNeighbors(token, recent, often, unwatched, "viewCount", "desc");
        assertNeighbors(token, often, null, recent, "viewCount", "desc");
        assertNeighbors(token, often, recent, unwatched, "lastWatchedAt", "desc");
        assertNeighbors(token, unwatched, often, null, "lastWatchedAt", "desc");
    }

    @Test
    void neighborLookupRequiresAuthenticationAndScopesTargetToAccount() throws Exception {
        Account owner = createAccount("neighbors-owner@example.com");
        Account other = createAccount("neighbors-other@example.com");
        LibraryVideo ownerVideo = createVideo(
                owner, "neighbors-owner", "Owner", 100, BASE_TIME);
        LibraryVideo otherVideo = createVideo(
                other, "neighbors-other", "Other", 100, BASE_TIME.plusSeconds(1));
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos/{id}/neighbors", ownerVideo.getId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        mockMvc.perform(get("/api/library/videos/{id}/neighbors", otherVideo.getId())
                        .cookie(token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));
    }

    private void assertNeighbors(
            Cookie token,
            LibraryVideo target,
            LibraryVideo previous,
            LibraryVideo next) throws Exception {
        assertNeighbors(token, target, previous, next, "addedAt", "desc");
    }

    private void assertNeighbors(
            Cookie token,
            LibraryVideo target,
            LibraryVideo previous,
            LibraryVideo next,
            String sortBy,
            String sortDirection) throws Exception {
        var result = mockMvc.perform(get("/api/library/videos/{id}/neighbors", target.getId())
                        .queryParam("sortBy", sortBy)
                        .queryParam("sortDirection", sortDirection)
                        .cookie(token))
                .andExpect(status().isOk());

        if (previous == null) {
            result.andExpect(jsonPath("$.previous").doesNotExist());
        } else {
            result.andExpect(jsonPath("$.previous.id").value(previous.getId()));
        }
        if (next == null) {
            result.andExpect(jsonPath("$.next").doesNotExist());
        } else {
            result.andExpect(jsonPath("$.next.id").value(next.getId()));
        }
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
        YouTubeVideo source = youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                title,
                "Channel",
                "https://image.example/" + youtubeVideoId + ".jpg",
                durationSeconds,
                BASE_TIME.minusYears(1),
                YouTubeAvailabilityStatus.AVAILABLE,
                BASE_TIME.minusYears(1)));
        return libraryVideoRepository.saveAndFlush(
                LibraryVideo.create(account, source, addedAt));
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
        Cookie accessToken = result.getResponse()
                .getCookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME);
        assertThat(accessToken).isNotNull();
        return accessToken;
    }

    private void insertValidSession(
            LibraryVideo video,
            OffsetDateTime startedAt) {
        jdbcTemplate.update("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, ?, ?, ?, 30, 'VALID')
                """,
                video.getId(),
                startedAt,
                startedAt.plusMinutes(1),
                startedAt.plusMinutes(1));
    }

    private CsrfExchange fetchCsrf() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andReturn();
        MockHttpServletResponse response = result.getResponse();
        Cookie csrfCookie = response.getCookie("XSRF-TOKEN");
        JsonNode body = objectMapper.readTree(response.getContentAsByteArray());
        assertThat(csrfCookie).isNotNull();
        return new CsrfExchange(
                csrfCookie,
                csrfCookie.getValue(),
                body.get("headerName").stringValue());
    }

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }
}
