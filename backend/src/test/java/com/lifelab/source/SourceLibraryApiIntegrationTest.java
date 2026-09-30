package com.lifelab.source;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import com.lifelab.video.domain.Tag;
import com.lifelab.video.repository.TagRepository;

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

    @Autowired
    private TagRepository tagRepository;

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

    @Test
    void imagePersonalMetadataSearchTagsAndFiltersRemainOwned() throws Exception {
        Account owner = createAccount("image-owner@example.com");
        Account other = createAccount("image-other@example.com");
        Cookie ownerToken = login(owner.getEmail());
        Cookie otherToken = login(other.getEmail());
        CsrfExchange ownerCsrf = fetchCsrf(ownerToken);
        CsrfExchange otherCsrf = fetchCsrf(otherToken);
        JsonNode image = responseBody(postJson("/api/library/images/url",
                "{\"url\":\"https://example.com/first.png\"}", ownerToken, ownerCsrf)
                .andExpect(status().isCreated()).andReturn());
        JsonNode second = responseBody(postJson("/api/library/images/url",
                "{\"url\":\"https://example.com/second.png\"}", ownerToken, ownerCsrf)
                .andExpect(status().isCreated()).andReturn());
        long imageId = image.get("id").longValue();
        long sourceId = image.get("sourceId").longValue();
        Tag ownedTag = tagRepository.saveAndFlush(Tag.create(owner, "Research", "research", OffsetDateTime.now()));
        Tag foreignTag = tagRepository.saveAndFlush(Tag.create(other, "Private", "private", OffsetDateTime.now()));

        mockMvc.perform(patch("/api/library/images/{id}", imageId)
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Phân tích thuật toán Đặc biệt\",\"personalDescription\":\"Ghi chú nghiên cứu\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Phân tích thuật toán Đặc biệt"))
                .andExpect(jsonPath("$.personalDescription").value("Ghi chú nghiên cứu"));
        assertThat(imageSourceRepository.findById(sourceId).orElseThrow().getExternalUrl())
                .isEqualTo("https://example.com/first.png");
        mockMvc.perform(patch("/api/library/images/{id}", imageId)
                        .cookie(otherToken, otherCsrf.cookie())
                        .header(otherCsrf.headerName(), otherCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Stolen\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/library/images/{id}/tags/{tagId}", imageId, ownedTag.getId())
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(put("/api/library/images/{id}/tags/{tagId}", imageId, ownedTag.getId())
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token()))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM library_image_tags WHERE library_image_id = ?", Integer.class, imageId)).isEqualTo(1);
        mockMvc.perform(put("/api/library/images/{id}/tags/{tagId}", imageId, foreignTag.getId())
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/library/images").queryParam("q", "phan tich")
                        .cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(imageId));
        mockMvc.perform(get("/api/library/images").queryParam("q", "DAC BIET")
                        .cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/library/images").queryParam("q", "nghien cuu")
                        .cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/library/images").queryParam("q", "research")
                        .cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/library/images").queryParam("q", "not-found")
                        .cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/library/images").queryParam("q", "phan tich")
                        .cookie(otherToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/library/images").queryParam("tagId", ownedTag.getId().toString())
                        .cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].tags[0].id").value(ownedTag.getId()));
        mockMvc.perform(get("/api/library/images").queryParam("tagId", foreignTag.getId().toString())
                        .cookie(ownerToken)).andExpect(status().isNotFound());
        jdbcTemplate.update("INSERT INTO notes (account_id, source_type, image_source_id, content, created_at, updated_at) VALUES (?, 'IMAGE', ?, 'Image note', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", owner.getId(), sourceId);
        mockMvc.perform(get("/api/library/images").queryParam("hasNotes", "true")
                        .queryParam("origin", "EXTERNAL").cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(imageId));
        mockMvc.perform(get("/api/library/images").queryParam("tagId", ownedTag.getId().toString())
                        .queryParam("hasNotes", "true").queryParam("origin", "EXTERNAL").cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/library/images").queryParam("tagId", ownedTag.getId().toString())
                        .queryParam("hasNotes", "false").cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/library/images").queryParam("hasNotes", "false")
                        .cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(second.get("id").longValue()));
        jdbcTemplate.update("UPDATE library_images SET added_at = ? WHERE id = ?",
                OffsetDateTime.parse("2024-01-01T00:00:00Z"), imageId);
        jdbcTemplate.update("UPDATE library_images SET added_at = ? WHERE id = ?",
                OffsetDateTime.parse("2025-01-01T00:00:00Z"), second.get("id").longValue());
        mockMvc.perform(get("/api/library/images").queryParam("addedFrom", "2024-01-01")
                        .queryParam("addedTo", "2024-01-01").cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(imageId));
        mockMvc.perform(get("/api/library/images").queryParam("sortBy", "addedAt")
                        .queryParam("sortDirection", "asc").cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(imageId));
        mockMvc.perform(get("/api/library/images").queryParam("sortBy", "title")
                        .queryParam("sortDirection", "asc").cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(second.get("id").longValue()));
        mockMvc.perform(delete("/api/library/images/{id}/tags/{tagId}", imageId, ownedTag.getId())
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/library/images").queryParam("tagId", ownedTag.getId().toString())
                        .cookie(ownerToken)).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(put("/api/library/images/{id}/tags/{tagId}", imageId, ownedTag.getId())
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/tags/{id}/delete-impact", ownedTag.getId()).cookie(ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.libraryImageCountToDetach").value(1))
                .andExpect(jsonPath("$.libraryImagesPreserved").value(true));
        mockMvc.perform(delete("/api/tags/{id}", ownedTag.getId())
                        .cookie(ownerToken, ownerCsrf.cookie())
                        .header(ownerCsrf.headerName(), ownerCsrf.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/library/images/{id}", imageId).cookie(ownerToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tags").isEmpty());
    }

    @Test
    void audioPersonalMetadataSearchTagsDatesAndSortingRemainOwned() throws Exception {
        Account owner = createAccount("audio-owner@example.com");
        Account other = createAccount("audio-other@example.com");
        Cookie token = login(owner.getEmail());
        Cookie otherToken = login(other.getEmail());
        CsrfExchange csrf = fetchCsrf(token);
        CsrfExchange otherCsrf = fetchCsrf(otherToken);
        JsonNode first = responseBody(postJson("/api/library/audio/url",
                "{\"url\":\"https://example.com/one.mp3\"}", token, csrf)
                .andExpect(status().isCreated()).andReturn());
        JsonNode second = responseBody(postJson("/api/library/audio/url",
                "{\"url\":\"https://example.com/two.mp3\"}", token, csrf)
                .andExpect(status().isCreated()).andReturn());
        long firstId = first.get("id").longValue();
        long sourceId = first.get("sourceId").longValue();
        Tag ownedTag = tagRepository.saveAndFlush(Tag.create(owner, "Lecture", "lecture", OffsetDateTime.now()));
        Tag foreignTag = tagRepository.saveAndFlush(Tag.create(other, "Private", "private", OffsetDateTime.now()));
        mockMvc.perform(patch("/api/library/audio/{id}", firstId)
                        .cookie(token, csrf.cookie()).header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Đường đi ngắn nhất\",\"personalDescription\":\"Phân tích thuật toán\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.personalDescription").value("Phân tích thuật toán"));
        assertThat(audioSourceRepository.findById(sourceId).orElseThrow().getExternalUrl())
                .isEqualTo("https://example.com/one.mp3");
        mockMvc.perform(patch("/api/library/audio/{id}", firstId)
                        .cookie(otherToken, otherCsrf.cookie()).header(otherCsrf.headerName(), otherCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Stolen\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(put("/api/library/audio/{id}/tags/{tagId}", firstId, ownedTag.getId())
                        .cookie(token, csrf.cookie()).header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(put("/api/library/audio/{id}/tags/{tagId}", firstId, ownedTag.getId())
                        .cookie(token, csrf.cookie()).header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject("SELECT count(*) FROM library_audio_tags WHERE library_audio_id = ?", Integer.class, firstId)).isEqualTo(1);
        mockMvc.perform(put("/api/library/audio/{id}/tags/{tagId}", firstId, foreignTag.getId())
                        .cookie(token, csrf.cookie()).header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNotFound());
        for (String query : new String[] {"duong di", "DUONG DI", "thuat toan", "one.mp3", "lecture"}) {
            mockMvc.perform(get("/api/library/audio").queryParam("q", query).cookie(token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.items[0].id").value(firstId));
        }
        mockMvc.perform(get("/api/library/audio").queryParam("q", "duong di").cookie(otherToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(get("/api/library/audio").queryParam("tagId", ownedTag.getId().toString()).cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/library/audio").queryParam("tagId", foreignTag.getId().toString()).cookie(token))
                .andExpect(status().isNotFound());
        jdbcTemplate.update("INSERT INTO notes (account_id, source_type, audio_source_id, content, created_at, updated_at) VALUES (?, 'AUDIO', ?, 'Audio note', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", owner.getId(), sourceId);
        mockMvc.perform(get("/api/library/audio").queryParam("hasNotes", "true")
                        .queryParam("origin", "EXTERNAL").cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(firstId));
        mockMvc.perform(get("/api/library/audio").queryParam("tagId", ownedTag.getId().toString())
                        .queryParam("hasNotes", "true").queryParam("origin", "EXTERNAL").cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mockMvc.perform(get("/api/library/audio").queryParam("tagId", ownedTag.getId().toString())
                        .queryParam("hasNotes", "false").cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        jdbcTemplate.update("UPDATE library_audio SET added_at = ? WHERE id = ?",
                OffsetDateTime.parse("2024-01-01T00:00:00Z"), firstId);
        jdbcTemplate.update("UPDATE library_audio SET added_at = ? WHERE id = ?",
                OffsetDateTime.parse("2025-01-01T00:00:00Z"), second.get("id").longValue());
        mockMvc.perform(get("/api/library/audio").queryParam("addedFrom", "2024-01-01")
                        .queryParam("addedTo", "2024-01-01").cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(firstId));
        mockMvc.perform(get("/api/library/audio").queryParam("sortBy", "addedAt")
                        .queryParam("sortDirection", "asc").cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(firstId));
        mockMvc.perform(get("/api/library/audio").queryParam("sortBy", "title")
                        .queryParam("sortDirection", "asc").cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(second.get("id").longValue()));
        mockMvc.perform(delete("/api/library/audio/{id}/tags/{tagId}", firstId, ownedTag.getId())
                        .cookie(token, csrf.cookie()).header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/library/audio").queryParam("tagId", ownedTag.getId().toString()).cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mockMvc.perform(put("/api/library/audio/{id}/tags/{tagId}", firstId, ownedTag.getId())
                        .cookie(token, csrf.cookie()).header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/tags/{id}/delete-impact", ownedTag.getId()).cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.libraryAudioCountToDetach").value(1))
                .andExpect(jsonPath("$.libraryAudioPreserved").value(true));
        mockMvc.perform(delete("/api/tags/{id}", ownedTag.getId())
                        .cookie(token, csrf.cookie()).header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/library/audio/{id}", firstId).cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tags").isEmpty());
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
