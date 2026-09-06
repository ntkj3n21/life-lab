package com.lifelab.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class LibraryVideoReadUpdateApiIntegrationTest {

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

    @MockitoBean
    private YouTubeMetadataClient youTubeMetadataClient;

    @BeforeEach
    void cleanDatabase() {
        libraryVideoRepository.deleteAll();
        youTubeVideoRepository.deleteAll();
        accountRepository.deleteAll();
    }

    @Test
    void listRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/library/videos"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void listIsAccountScopedPagedAndDeterministicallyOrdered() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        OffsetDateTime oldTime = OffsetDateTime.parse("2024-01-01T00:00:00Z");
        OffsetDateTime recentTime = OffsetDateTime.parse("2024-02-01T00:00:00Z");
        LibraryVideo oldVideo = createLibraryVideo(owner, "old", oldTime, null, null);
        LibraryVideo recentLowerId = createLibraryVideo(owner, "recent-1", recentTime, null, null);
        LibraryVideo recentHigherId = createLibraryVideo(owner, "recent-2", recentTime, null, null);
        createLibraryVideo(other, "other", recentTime.plusDays(1), null, null);
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("page", "0")
                        .queryParam("size", "2")
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(recentHigherId.getId()))
                .andExpect(jsonPath("$.items[1].id").value(recentLowerId.getId()))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));

        mockMvc.perform(get("/api/library/videos")
                        .queryParam("page", "1")
                        .queryParam("size", "2")
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(oldVideo.getId()));
    }

    @Test
    void invalidPaginationUsesStandardValidationError() throws Exception {
        Account owner = createAccount("owner@example.com");
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(get("/api/library/videos").queryParam("page", "-1").cookie(accessToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.page").exists());
        mockMvc.perform(get("/api/library/videos").queryParam("size", "0").cookie(accessToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.size").exists());
        mockMvc.perform(get("/api/library/videos").queryParam("size", "101").cookie(accessToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.size").exists());
    }

    @Test
    void ownerCanReadSourceAndPersonalInformationWithoutAccountData() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(
                owner, "detail", OffsetDateTime.parse("2024-01-01T00:00:00Z"), "My title", "My notes");
        Cookie accessToken = login(owner.getEmail());

        MvcResult result = mockMvc.perform(get("/api/library/videos/{id}", video.getId()).cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(video.getId()))
                .andExpect(jsonPath("$.customTitle").value("My title"))
                .andExpect(jsonPath("$.personalDescription").value("My notes"))
                .andExpect(jsonPath("$.youtubeSource.youtubeVideoId").value("detail"))
                .andExpect(jsonPath("$.youtubeSource.sourceUrl")
                        .value("https://www.youtube.com/watch?v=detail"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        assertThat(body.has("account")).isFalse();
        assertThat(body.has("accountId")).isFalse();
    }

    @Test
    void unknownAndOtherAccountsVideoUseTheSameNotFoundResponse() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        LibraryVideo otherVideo = createLibraryVideo(other, "private", OffsetDateTime.now(), null, null);
        Cookie accessToken = login(owner.getEmail());

        for (Long id : new Long[] {Long.MAX_VALUE, otherVideo.getId()}) {
            mockMvc.perform(get("/api/library/videos/{id}", id).cookie(accessToken))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("The library video could not be found."));
        }
    }

    @Test
    void ownerUpdateChangesOnlyPersonalInformationAndUpdatedTimestamp() throws Exception {
        Account owner = createAccount("owner@example.com");
        OffsetDateTime originalTime = OffsetDateTime.parse("2024-01-01T00:00:00Z");
        LibraryVideo video = createLibraryVideo(owner, "update", originalTime, null, null);
        YouTubeVideo sourceBefore = youTubeVideoRepository.findByYoutubeVideoId("update").orElseThrow();
        Long sourceId = sourceBefore.getId();
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        mockMvc.perform(patch("/api/library/videos/{id}", video.getId())
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customTitle":"Updated title","personalDescription":"Updated description"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customTitle").value("Updated title"))
                .andExpect(jsonPath("$.personalDescription").value("Updated description"))
                .andExpect(jsonPath("$.youtubeSource.id").value(sourceId))
                .andExpect(jsonPath("$.youtubeSource.youtubeVideoId").value("update"))
                .andExpect(jsonPath("$.youtubeSource.sourceUrl")
                        .value("https://www.youtube.com/watch?v=update"));

        LibraryVideo persisted = libraryVideoRepository
                .findByIdAndAccount_Id(video.getId(), owner.getId()).orElseThrow();
        YouTubeVideo sourceAfter = youTubeVideoRepository.findByYoutubeVideoId("update").orElseThrow();
        assertThat(persisted.getCustomTitle()).isEqualTo("Updated title");
        assertThat(persisted.getPersonalDescription()).isEqualTo("Updated description");
        assertThat(persisted.getAddedAt()).isEqualTo(originalTime);
        assertThat(persisted.getUpdatedAt()).isAfter(originalTime);
        assertThat(persisted.getYoutubeSource().getId()).isEqualTo(sourceId);
        assertThat(sourceAfter.getSourceUrl()).isEqualTo(sourceBefore.getSourceUrl());
        assertThat(sourceAfter.getTitle()).isEqualTo(sourceBefore.getTitle());
        assertThat(sourceAfter.getChannelName()).isEqualTo(sourceBefore.getChannelName());
        assertThat(sourceAfter.getThumbnailUrl()).isEqualTo(sourceBefore.getThumbnailUrl());
        assertThat(sourceAfter.getDurationSeconds()).isEqualTo(sourceBefore.getDurationSeconds());
        assertThat(sourceAfter.getPublishedAt()).isEqualTo(sourceBefore.getPublishedAt());
        assertThat(sourceAfter.getAvailabilityStatus()).isEqualTo(sourceBefore.getAvailabilityStatus());
    }

    @Test
    void nullUpdateValuesClearBothPersonalFields() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, "clear", OffsetDateTime.now(), "Title", "Description");
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        mockMvc.perform(patch("/api/library/videos/{id}", video.getId())
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customTitle":null,"personalDescription":null}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customTitle").doesNotExist())
                .andExpect(jsonPath("$.personalDescription").doesNotExist());

        LibraryVideo persisted = libraryVideoRepository
                .findByIdAndAccount_Id(video.getId(), owner.getId()).orElseThrow();
        assertThat(persisted.getCustomTitle()).isNull();
        assertThat(persisted.getPersonalDescription()).isNull();
    }

    @Test
    void invalidAndCrossAccountUpdatesLeavePersistedValuesUnchanged() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        LibraryVideo video = createLibraryVideo(owner, "protected", OffsetDateTime.now(), "Original", "Original notes");
        Cookie ownerToken = login(owner.getEmail());
        Cookie otherToken = login(other.getEmail());
        CsrfExchange ownerCsrf = fetchCsrf(ownerToken);
        CsrfExchange otherCsrf = fetchCsrf(otherToken);

        mockMvc.perform(patch("/api/library/videos/{id}", video.getId())
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customTitle":"%s","personalDescription":"Changed"}
                                """.formatted("x".repeat(256))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        mockMvc.perform(patch("/api/library/videos/{id}", video.getId())
                        .cookie(otherToken, otherCsrf.cookie())
                        .header(otherCsrf.headerName(), otherCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"customTitle":"Intruder","personalDescription":"Intruder notes"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));

        LibraryVideo persisted = libraryVideoRepository
                .findByIdAndAccount_Id(video.getId(), owner.getId()).orElseThrow();
        assertThat(persisted.getCustomTitle()).isEqualTo("Original");
        assertThat(persisted.getPersonalDescription()).isEqualTo("Original notes");
    }

    @Test
    void patchRequiresValidCsrf() throws Exception {
        Account owner = createAccount("owner@example.com");
        LibraryVideo video = createLibraryVideo(owner, "csrf", OffsetDateTime.now(), null, null);
        Cookie accessToken = login(owner.getEmail());

        mockMvc.perform(patch("/api/library/videos/{id}", video.getId())
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
    }

    private LibraryVideo createLibraryVideo(
            Account account,
            String youtubeVideoId,
            OffsetDateTime addedAt,
            String customTitle,
            String personalDescription) {
        YouTubeVideo source = youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                "Source title " + youtubeVideoId,
                "Source channel",
                "https://image.example/" + youtubeVideoId + ".jpg",
                321,
                OffsetDateTime.parse("2023-04-15T09:30:00Z"),
                YouTubeAvailabilityStatus.AVAILABLE,
                addedAt));
        LibraryVideo libraryVideo = LibraryVideo.create(account, source, addedAt);
        if (customTitle != null || personalDescription != null) {
            libraryVideo.updatePersonalInfo(customTitle, personalDescription, addedAt);
        }
        return libraryVideoRepository.saveAndFlush(libraryVideo);
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
