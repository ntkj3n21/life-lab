package com.lifelab.source;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.Arrays;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.lifelab.TestcontainersConfiguration;
import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.auth.security.JwtCookieService;
import com.lifelab.source.audio.repository.AudioSourceRepository;
import com.lifelab.source.audio.repository.LibraryAudioRepository;
import com.lifelab.source.image.repository.ImageSourceRepository;
import com.lifelab.source.image.repository.LibraryImageRepository;

import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "app.security.jwt.secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "app.security.cookie.secure=false",
        "app.image-storage.location=target/test-image-storage",
        "app.image-storage.max-upload-size=64B",
        "app.audio-storage.location=target/test-audio-storage",
        "app.audio-storage.max-upload-size=64B",
        "spring.servlet.multipart.max-file-size=1MB",
        "spring.servlet.multipart.max-request-size=1MB"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SourceLibraryApiIntegrationTest {

    private static final String PASSWORD = "Password123";
    private static final byte[] PNG_BYTES = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x00
    };
    private static final byte[] MP3_BYTES = {
            'I', 'D', '3', 0x04, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, (byte) 0xFF, (byte) 0xFB, (byte) 0x90, 0x00
    };

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private ImageSourceRepository imageSourceRepository;

    @Autowired
    private LibraryImageRepository libraryImageRepository;

    @Autowired
    private AudioSourceRepository audioSourceRepository;

    @Autowired
    private LibraryAudioRepository libraryAudioRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final Path storagePath = Path.of("target/test-image-storage").toAbsolutePath();
    private final Path audioStoragePath = Path.of("target/test-audio-storage").toAbsolutePath();

    @BeforeEach
    void cleanFixtures() throws IOException {
        jdbcTemplate.execute("""
                TRUNCATE TABLE library_audio, audio_sources, library_images, image_sources,
                    accounts RESTART IDENTITY CASCADE
                """);
        Files.createDirectories(storagePath);
        try (var files = Files.list(storagePath)) {
            files.forEach(this::deleteFixtureFile);
        }
        Files.createDirectories(audioStoragePath);
        try (var files = Files.list(audioStoragePath)) {
            files.forEach(this::deleteFixtureFile);
        }
    }

    @Test
    void externalImageCreateListGetAndRemovePreservesSource() throws Exception {
        Account account = createAccount("image@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        MvcResult created = postJson(
                "/api/library/images/url",
                "{\"url\":\"https://images.example/photo.jpg\"}",
                accessToken,
                csrf)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.origin").value("EXTERNAL"))
                .andExpect(jsonPath("$.url").value("https://images.example/photo.jpg"))
                .andExpect(jsonPath("$.sourceId").isNumber())
                .andReturn();

        JsonNode body = objectMapper.readTree(created.getResponse().getContentAsByteArray());
        long imageId = body.get("id").longValue();
        long sourceId = body.get("sourceId").longValue();

        mockMvc.perform(get("/api/library/images")
                        .param("page", "0")
                        .param("size", "1")
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(imageId))
                .andExpect(jsonPath("$.items[0].sourceId").value(sourceId))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(1));

        mockMvc.perform(get("/api/library/images/{id}", imageId).cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceId").value(sourceId));

        mockMvc.perform(get("/api/images/{sourceId}/content", sourceId).cookie(accessToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("IMAGE_CONTENT_NOT_FOUND"));

        mockMvc.perform(delete("/api/library/images/{id}", imageId)
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());

        assertThat(libraryImageRepository.findById(imageId)).isEmpty();
        assertThat(imageSourceRepository.findById(sourceId)).isPresent();
    }

    @Test
    void validUploadServesOwnedBytesAndRemovalPreservesSourceAndFile() throws Exception {
        Account account = createAccount("upload@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);
        MockMultipartFile file = new MockMultipartFile(
                "file", "../client-image.png", MediaType.IMAGE_PNG_VALUE, PNG_BYTES);

        MvcResult created = mockMvc.perform(multipart("/api/library/images/upload")
                        .file(file)
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.origin").value("UPLOAD"))
                .andExpect(jsonPath("$.originalFilename").value("client-image.png"))
                .andExpect(jsonPath("$.mediaType").value(MediaType.IMAGE_PNG_VALUE))
                .andExpect(jsonPath("$.sizeBytes").value(PNG_BYTES.length))
                .andExpect(jsonPath("$.url").doesNotExist())
                .andReturn();

        JsonNode body = objectMapper.readTree(created.getResponse().getContentAsByteArray());
        long imageId = body.get("id").longValue();
        long sourceId = body.get("sourceId").longValue();
        String storageKey = imageSourceRepository.findById(sourceId).orElseThrow().getStorageKey();

        mockMvc.perform(get("/api/images/{sourceId}/content", sourceId).cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(content().bytes(PNG_BYTES));

        mockMvc.perform(delete("/api/library/images/{id}", imageId)
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());

        assertThat(imageSourceRepository.findById(sourceId)).isPresent();
        assertThat(storagePath.resolve(storageKey)).exists();
        mockMvc.perform(get("/api/images/{sourceId}/content", sourceId).cookie(accessToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void uploadRejectsUnsupportedAndOversizedFiles() throws Exception {
        Account account = createAccount("invalid-upload@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);
        MockMultipartFile svg = new MockMultipartFile(
                "file", "vector.svg", "image/svg+xml", "<svg></svg>".getBytes());

        mockMvc.perform(multipart("/api/library/images/upload")
                        .file(svg)
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IMAGE"))
                .andExpect(jsonPath("$.fieldErrors.file").exists());

        byte[] oversized = new byte[65];
        System.arraycopy(PNG_BYTES, 0, oversized, 0, PNG_BYTES.length);
        MockMultipartFile large = new MockMultipartFile(
                "file", "large.png", MediaType.IMAGE_PNG_VALUE, oversized);

        mockMvc.perform(multipart("/api/library/images/upload")
                        .file(large)
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IMAGE"))
                .andExpect(jsonPath("$.fieldErrors.file").exists());

        assertThat(imageSourceRepository.count()).isZero();
        assertThat(libraryImageRepository.count()).isZero();
    }

    @Test
    void imageLibraryAndUploadedContentAreAccountScoped() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        Cookie ownerToken = login(owner.getEmail());
        Cookie otherToken = login(other.getEmail());
        CsrfExchange ownerCsrf = fetchCsrf(ownerToken);
        MockMultipartFile file = new MockMultipartFile(
                "file", "private.png", MediaType.IMAGE_PNG_VALUE, PNG_BYTES);

        MvcResult created = mockMvc.perform(multipart("/api/library/images/upload")
                        .file(file)
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token()))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode body = objectMapper.readTree(created.getResponse().getContentAsByteArray());

        mockMvc.perform(get("/api/library/images/{id}", body.get("id").longValue())
                        .cookie(otherToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LIBRARY_IMAGE_NOT_FOUND"));

        mockMvc.perform(get("/api/images/{sourceId}/content", body.get("sourceId").longValue())
                        .cookie(otherToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("IMAGE_CONTENT_NOT_FOUND"));

        mockMvc.perform(get("/api/library/images").cookie(otherToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void externalImageSourceIdentityCanBeSharedWithoutSharingMembership() throws Exception {
        Account first = createAccount("first-image@example.com");
        Account second = createAccount("second-image@example.com");
        Cookie firstToken = login(first.getEmail());
        Cookie secondToken = login(second.getEmail());
        CsrfExchange firstCsrf = fetchCsrf(firstToken);
        CsrfExchange secondCsrf = fetchCsrf(secondToken);
        String request = "{\"url\":\"https://images.example/shared.webp\"}";

        JsonNode firstBody = responseBody(postJson(
                "/api/library/images/url", request, firstToken, firstCsrf)
                .andExpect(status().isCreated())
                .andReturn());
        JsonNode secondBody = responseBody(postJson(
                "/api/library/images/url", request, secondToken, secondCsrf)
                .andExpect(status().isCreated())
                .andReturn());

        assertThat(secondBody.get("sourceId").longValue())
                .isEqualTo(firstBody.get("sourceId").longValue());
        assertThat(firstBody.get("id").longValue())
                .isNotEqualTo(secondBody.get("id").longValue());
    }

    @Test
    void audioCreateListGetAndRemovePreservesSourceWithPagination() throws Exception {
        Account account = createAccount("audio@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        JsonNode first = responseBody(postJson(
                "/api/library/audio/url",
                "{\"url\":\"https://audio.example/one.mp3\",\"title\":\" First \"}",
                accessToken,
                csrf)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.origin").value("EXTERNAL"))
                .andExpect(jsonPath("$.title").value("First"))
                .andExpect(jsonPath("$.originalFilename").doesNotExist())
                .andExpect(jsonPath("$.mediaType").doesNotExist())
                .andExpect(jsonPath("$.sizeBytes").doesNotExist())
                .andExpect(jsonPath("$.sourceId").isNumber())
                .andReturn());
        postJson(
                "/api/library/audio/url",
                "{\"url\":\"http://audio.example/two.ogg\"}",
                accessToken,
                csrf)
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/library/audio")
                        .param("page", "0")
                        .param("size", "1")
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2));

        mockMvc.perform(get("/api/library/audio/{id}", first.get("id").longValue())
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceId").value(first.get("sourceId").longValue()))
                .andExpect(jsonPath("$.url").value("https://audio.example/one.mp3"));

        mockMvc.perform(delete("/api/library/audio/{id}", first.get("id").longValue())
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());

        assertThat(libraryAudioRepository.findById(first.get("id").longValue())).isEmpty();
        assertThat(audioSourceRepository.findById(first.get("sourceId").longValue())).isPresent();
    }

    @Test
    void audioUploadServesOwnedBytesAndSurvivesMembershipRemovalThroughNote() throws Exception {
        Account owner = createAccount("audio-upload@example.com");
        Account other = createAccount("other-audio@example.com");
        Cookie ownerToken = login(owner.getEmail());
        Cookie otherToken = login(other.getEmail());
        CsrfExchange ownerCsrf = fetchCsrf(ownerToken);
        MockMultipartFile file = new MockMultipartFile(
                "file", "../private-track.mp3", "audio/mpeg", MP3_BYTES);

        JsonNode uploaded = responseBody(mockMvc.perform(multipart("/api/library/audio/upload")
                        .file(file)
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.origin").value("UPLOAD"))
                .andExpect(jsonPath("$.url").doesNotExist())
                .andExpect(jsonPath("$.originalFilename").value("private-track.mp3"))
                .andExpect(jsonPath("$.mediaType").value("audio/mpeg"))
                .andExpect(jsonPath("$.sizeBytes").value(MP3_BYTES.length))
                .andExpect(jsonPath("$.storageKey").doesNotExist())
                .andReturn());
        long audioId = uploaded.get("id").longValue();
        long sourceId = uploaded.get("sourceId").longValue();
        String storageKey = audioSourceRepository.findById(sourceId).orElseThrow().getStorageKey();

        mockMvc.perform(get("/api/audio/{sourceId}/content", sourceId).cookie(ownerToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType("audio/mpeg"))
                .andExpect(content().bytes(MP3_BYTES));
        mockMvc.perform(get("/api/audio/{sourceId}/content", sourceId)
                        .header("Range", "bytes=0-3")
                        .cookie(ownerToken))
                .andExpect(status().isPartialContent())
                .andExpect(content().contentType("audio/mpeg"))
                .andExpect(content().bytes(Arrays.copyOfRange(MP3_BYTES, 0, 4)));
        mockMvc.perform(get("/api/audio/{sourceId}/content", sourceId).cookie(otherToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("AUDIO_CONTENT_NOT_FOUND"));

        JsonNode note = responseBody(postJson(
                "/api/library/audio/%d/notes".formatted(audioId),
                "{\"content\":\"Private timestamp\",\"timestampSeconds\":0,\"withoutTimestampConfirmed\":false}",
                ownerToken,
                ownerCsrf)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.audioSource.origin").value("UPLOAD"))
                .andExpect(jsonPath("$.audioSource.storageKey").doesNotExist())
                .andReturn());
        JsonNode task = responseBody(postJson(
                "/api/notes/%d/tasks".formatted(note.get("id").longValue()),
                "{\"title\":\"Keep exact audio\",\"description\":null,\"deadline\":null}",
                ownerToken,
                ownerCsrf)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceStatus").value("HAS_SOURCE"))
                .andReturn());

        mockMvc.perform(delete("/api/library/audio/{id}", audioId)
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token()))
                .andExpect(status().isNoContent());

        assertThat(audioSourceRepository.findById(sourceId)).isPresent();
        assertThat(audioStoragePath.resolve(storageKey)).exists();
        mockMvc.perform(get("/api/audio/{sourceId}/content", sourceId).cookie(ownerToken))
                .andExpect(status().isOk())
                .andExpect(content().bytes(MP3_BYTES));
        mockMvc.perform(get("/api/notes/{id}", note.get("id").longValue()).cookie(ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.audioSource.id").value(sourceId));
        mockMvc.perform(get("/api/tasks/{id}", task.get("id").longValue()).cookie(ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceStatus").value("HAS_SOURCE"));
    }

    @Test
    void audioUploadRejectsInvalidAndOversizedFilesAndDoesNotDeduplicateByFilename() throws Exception {
        Account account = createAccount("audio-upload-validation@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        MockMultipartFile invalid = new MockMultipartFile(
                "file", "fake.mp3", "audio/mpeg", "not audio".getBytes());
        mockMvc.perform(multipart("/api/library/audio/upload")
                        .file(invalid)
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_AUDIO"))
                .andExpect(jsonPath("$.fieldErrors.file").exists());

        byte[] oversized = new byte[65];
        System.arraycopy(MP3_BYTES, 0, oversized, 0, MP3_BYTES.length);
        MockMultipartFile large = new MockMultipartFile(
                "file", "large.mp3", "audio/mpeg", oversized);
        mockMvc.perform(multipart("/api/library/audio/upload")
                        .file(large)
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_AUDIO"))
                .andExpect(jsonPath("$.fieldErrors.file").exists());

        JsonNode first = uploadAudio("same.mp3", accessToken, csrf);
        JsonNode second = uploadAudio("same.mp3", accessToken, csrf);
        assertThat(second.get("sourceId").longValue())
                .isNotEqualTo(first.get("sourceId").longValue());
    }

    @Test
    void sharedAudioSourceKeepsPerAccountTitlesPrivate() throws Exception {
        Account firstAccount = createAccount("first-audio@example.com");
        Account secondAccount = createAccount("second-audio@example.com");
        Cookie firstToken = login(firstAccount.getEmail());
        Cookie secondToken = login(secondAccount.getEmail());
        CsrfExchange firstCsrf = fetchCsrf(firstToken);
        CsrfExchange secondCsrf = fetchCsrf(secondToken);
        String url = "https://audio.example/shared.mp3";

        JsonNode first = responseBody(postJson(
                "/api/library/audio/url",
                "{\"url\":\"%s\",\"title\":\"First title\"}".formatted(url),
                firstToken,
                firstCsrf)
                .andExpect(status().isCreated())
                .andReturn());
        JsonNode second = responseBody(postJson(
                "/api/library/audio/url",
                "{\"url\":\"%s\",\"title\":\"Second title\"}".formatted(url),
                secondToken,
                secondCsrf)
                .andExpect(status().isCreated())
                .andReturn());

        assertThat(second.get("sourceId").longValue())
                .isEqualTo(first.get("sourceId").longValue());
        mockMvc.perform(get("/api/library/audio/{id}", first.get("id").longValue())
                        .cookie(firstToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("First title"));
        mockMvc.perform(get("/api/library/audio/{id}", second.get("id").longValue())
                        .cookie(secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Second title"));
    }

    @Test
    void invalidUrlSchemesAreRejectedWithoutPersistence() throws Exception {
        Account account = createAccount("invalid-url@example.com");
        Cookie accessToken = login(account.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        postJson(
                "/api/library/images/url",
                "{\"url\":\"file:///tmp/private.png\"}",
                accessToken,
                csrf)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_IMAGE"))
                .andExpect(jsonPath("$.fieldErrors.url").exists());

        postJson(
                "/api/library/audio/url",
                "{\"url\":\"ftp://audio.example/file.mp3\"}",
                accessToken,
                csrf)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_AUDIO"))
                .andExpect(jsonPath("$.fieldErrors.url").exists());

        assertThat(imageSourceRepository.count()).isZero();
        assertThat(audioSourceRepository.count()).isZero();
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
    }

    private org.springframework.test.web.servlet.ResultActions postJson(
            String path,
            String body,
            Cookie accessToken,
            CsrfExchange csrf) throws Exception {
        return mockMvc.perform(post(path)
                .cookie(accessToken, csrf.cookie())
                .header(csrf.headerName(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private JsonNode responseBody(MvcResult result) throws IOException {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private JsonNode uploadAudio(String filename, Cookie accessToken, CsrfExchange csrf) throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", filename, "audio/mpeg", MP3_BYTES);
        return responseBody(mockMvc.perform(multipart("/api/library/audio/upload")
                        .file(file)
                        .cookie(accessToken, csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isCreated())
                .andReturn());
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

    private void deleteFixtureFile(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not clean test image fixture.", exception);
        }
    }

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }
}
