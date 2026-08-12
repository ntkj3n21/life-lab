package com.lifelab.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;

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
import com.lifelab.video.integration.youtube.ResolvedYouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
import com.lifelab.video.integration.youtube.YouTubeServiceException;
import com.lifelab.video.integration.youtube.YouTubeVideoNotFoundException;
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
class LibraryVideoApiIntegrationTest {

    private static final String PASSWORD = "Password123";
    private static final String VIDEO_ID = "source-id";
    private static final String INPUT_URL = "https://youtu.be/source-id?si=tracking";
    private static final String CANONICAL_URL = "https://www.youtube.com/watch?v=source-id";

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
        libraryVideoRepository.deleteAll();
        youTubeVideoRepository.deleteAll();
        accountRepository.deleteAll();
    }

    @Test
    void requiresAuthenticationAndCsrf() throws Exception {
        CsrfExchange guestCsrf = fetchCsrf();
        mockMvc.perform(post("/api/library/videos")
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addVideoJson(INPUT_URL)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Account account = createAccount("user@example.com");
        Cookie accessToken = login(account.getEmail());
        mockMvc.perform(post("/api/library/videos")
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addVideoJson(INPUT_URL)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void addsResolvedSourceToAuthenticatedPersonalLibrary() throws Exception {
        Account account = createAccount("user@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);
        when(youTubeMetadataClient.resolve(VIDEO_ID)).thenReturn(completeResolvedVideo());

        MvcResult result = addVideo(accessToken, csrf, INPUT_URL)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.youtubeSource.youtubeVideoId").value(VIDEO_ID))
                .andExpect(jsonPath("$.youtubeSource.sourceUrl").value(CANONICAL_URL))
                .andExpect(jsonPath("$.youtubeSource.title").value("Resolved title"))
                .andExpect(jsonPath("$.customTitle").doesNotExist())
                .andExpect(jsonPath("$.personalDescription").doesNotExist())
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        assertThat(body.has("account")).isFalse();
        assertThat(body.has("accountId")).isFalse();
        assertThat(youTubeVideoRepository.count()).isEqualTo(1);
        assertThat(libraryVideoRepository.count()).isEqualTo(1);
        LibraryVideo libraryVideo = libraryVideoRepository.findAll().get(0);
        var persistedSource = youTubeVideoRepository.findByYoutubeVideoId(VIDEO_ID).orElseThrow();
        assertThat(libraryVideo.getAccount().getId()).isEqualTo(account.getId());
        assertThat(libraryVideo.getYoutubeSource().getId()).isEqualTo(persistedSource.getId());
        assertThat(persistedSource.getSourceUrl()).isEqualTo(CANONICAL_URL);
        assertThat(libraryVideo.getCustomTitle()).isNull();
        assertThat(libraryVideo.getPersonalDescription()).isNull();
        assertDerivedTablesRemainEmpty();
    }

    @Test
    void preservesNullOptionalSourceMetadata() throws Exception {
        Account account = createAccount("user@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);
        when(youTubeMetadataClient.resolve(VIDEO_ID)).thenReturn(new ResolvedYouTubeVideo(
                VIDEO_ID,
                CANONICAL_URL,
                null,
                null,
                null,
                null,
                null,
                YouTubeAvailabilityStatus.AVAILABLE));

        addVideo(accessToken, csrf, INPUT_URL)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.youtubeSource.title").doesNotExist())
                .andExpect(jsonPath("$.youtubeSource.channelName").doesNotExist())
                .andExpect(jsonPath("$.youtubeSource.thumbnailUrl").doesNotExist())
                .andExpect(jsonPath("$.youtubeSource.durationSeconds").doesNotExist())
                .andExpect(jsonPath("$.youtubeSource.publishedAt").doesNotExist());

        var source = youTubeVideoRepository.findByYoutubeVideoId(VIDEO_ID).orElseThrow();
        assertThat(source.getTitle()).isNull();
        assertThat(source.getDurationSeconds()).isNull();
    }

    @Test
    void rejectsDuplicateOnlyWithinCurrentAccount() throws Exception {
        Account account = createAccount("user@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);
        when(youTubeMetadataClient.resolve(VIDEO_ID)).thenReturn(completeResolvedVideo());

        addVideo(accessToken, csrf, INPUT_URL).andExpect(status().isCreated());
        addVideo(accessToken, csrf, INPUT_URL)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_ALREADY_EXISTS"));

        assertThat(youTubeVideoRepository.count()).isEqualTo(1);
        assertThat(libraryVideoRepository.count()).isEqualTo(1);
    }

    @Test
    void reusesOneSharedSourceAcrossDifferentAccounts() throws Exception {
        Account firstAccount = createAccount("first@example.com");
        Account secondAccount = createAccount("second@example.com");
        Cookie firstAccessToken = login(firstAccount.getEmail());
        Cookie secondAccessToken = login(secondAccount.getEmail());
        CsrfExchange firstCsrf = fetchCsrf(firstAccessToken);
        CsrfExchange secondCsrf = fetchCsrf(secondAccessToken);
        when(youTubeMetadataClient.resolve(VIDEO_ID)).thenReturn(completeResolvedVideo());

        addVideo(firstAccessToken, firstCsrf, INPUT_URL).andExpect(status().isCreated());
        addVideo(secondAccessToken, secondCsrf, INPUT_URL).andExpect(status().isCreated());

        assertThat(youTubeVideoRepository.count()).isEqualTo(1);
        assertThat(libraryVideoRepository.count()).isEqualTo(2);
        Long sourceId = youTubeVideoRepository.findByYoutubeVideoId(VIDEO_ID).orElseThrow().getId();
        assertThat(libraryVideoRepository.existsByAccount_IdAndYoutubeSource_Id(
                firstAccount.getId(), sourceId)).isTrue();
        assertThat(libraryVideoRepository.existsByAccount_IdAndYoutubeSource_Id(
                secondAccount.getId(), sourceId)).isTrue();
    }

    @Test
    void invalidUrlStopsBeforeYouTubeResolutionOrPersistence() throws Exception {
        Account account = createAccount("user@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        addVideo(accessToken, csrf, "https://example.com/not-youtube")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_YOUTUBE_URL"));

        verifyNoInteractions(youTubeMetadataClient);
        assertNoVideoRows();
    }

    @Test
    void videoNotFoundDoesNotPersistAnything() throws Exception {
        Account account = createAccount("user@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);
        when(youTubeMetadataClient.resolve(VIDEO_ID)).thenThrow(new YouTubeVideoNotFoundException());

        addVideo(accessToken, csrf, INPUT_URL)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("YOUTUBE_VIDEO_NOT_FOUND"));

        assertNoVideoRows();
    }

    @Test
    void youtubeServiceFailureDoesNotPersistAnything() throws Exception {
        Account account = createAccount("user@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);
        when(youTubeMetadataClient.resolve(VIDEO_ID))
                .thenThrow(new YouTubeServiceException("sensitive upstream detail"));

        addVideo(accessToken, csrf, INPUT_URL)
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("YOUTUBE_SERVICE_ERROR"))
                .andExpect(jsonPath("$.message").value("YouTube service is unavailable."));

        assertNoVideoRows();
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
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
        return new CsrfExchange(
                csrfCookie,
                csrfCookie.getValue(),
                body.get("headerName").stringValue());
    }

    private org.springframework.test.web.servlet.ResultActions addVideo(
            Cookie accessToken,
            CsrfExchange csrf,
            String youtubeUrl) throws Exception {
        return mockMvc.perform(post("/api/library/videos")
                .cookie(accessToken, csrf.cookie())
                .header(csrf.headerName(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(addVideoJson(youtubeUrl)));
    }

    private String addVideoJson(String youtubeUrl) {
        return """
                {"youtubeUrl":"%s"}
                """.formatted(youtubeUrl);
    }

    private ResolvedYouTubeVideo completeResolvedVideo() {
        return new ResolvedYouTubeVideo(
                VIDEO_ID,
                CANONICAL_URL,
                "Resolved title",
                "Resolved channel",
                "https://image.example/thumbnail.jpg",
                321,
                OffsetDateTime.parse("2024-04-15T09:30:00Z"),
                YouTubeAvailabilityStatus.AVAILABLE);
    }

    private void assertNoVideoRows() {
        assertThat(youTubeVideoRepository.count()).isZero();
        assertThat(libraryVideoRepository.count()).isZero();
    }

    private void assertDerivedTablesRemainEmpty() {
        for (String table : new String[] {
                "library_video_tags", "tags", "watch_sessions", "notes", "tasks"}) {
            Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
            assertThat(count).as(table).isZero();
        }
    }

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }
}
