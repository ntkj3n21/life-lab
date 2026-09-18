package com.lifelab.note;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.lifelab.TestcontainersConfiguration;
import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.auth.security.JwtCookieService;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.source.audio.repository.AudioSourceRepository;
import com.lifelab.source.image.repository.ImageSourceRepository;
import com.lifelab.task.repository.TaskRepository;
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
        "app.security.cookie.secure=false",
        "app.image-storage.location=target/test-multisource-image-storage",
        "app.image-storage.max-upload-size=1KB",
        "spring.servlet.multipart.max-file-size=1MB",
        "spring.servlet.multipart.max-request-size=1MB"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class MultiSourceNoteApiIntegrationTest {

    private static final String PASSWORD = "Password123";
    private static final byte[] PNG_BYTES = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x00
    };

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ImageSourceRepository imageSourceRepository;

    @Autowired
    private AudioSourceRepository audioSourceRepository;

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

    private final Path storagePath = Path.of(
            "target/test-multisource-image-storage").toAbsolutePath();

    @BeforeEach
    void cleanFixtures() throws IOException {
        jdbcTemplate.execute("""
                TRUNCATE TABLE accounts, youtube_videos, image_sources, audio_sources
                    RESTART IDENTITY CASCADE
                """);
        Files.createDirectories(storagePath);
        try (var files = Files.list(storagePath)) {
            files.forEach(this::deleteFixtureFile);
        }
    }

    @Test
    void imageNoteRetainsExactSourceTaskLifecycleAndUploadedPreviewAccess() throws Exception {
        Account owner = createAccount("image-note@example.com");
        Account other = createAccount("image-other@example.com");
        Session ownerSession = loginSession(owner.getEmail());
        Session otherSession = loginSession(other.getEmail());
        JsonNode image = uploadImage(ownerSession, "exact-provenance.png");

        JsonNode note = responseBody(postJson(
                "/api/library/images/%d/notes".formatted(image.get("id").longValue()),
                "{\"content\":\"Image observation\"}",
                ownerSession)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceType").value("IMAGE"))
                .andExpect(jsonPath("$.youtubeSource").doesNotExist())
                .andExpect(jsonPath("$.audioSource").doesNotExist())
                .andExpect(jsonPath("$.imageSource.id").value(image.get("sourceId").longValue()))
                .andExpect(jsonPath("$.imageSource.origin").value("UPLOAD"))
                .andExpect(jsonPath("$.imageSource.originalFilename").value("exact-provenance.png"))
                .andExpect(jsonPath("$.imageSource.mediaType").value(MediaType.IMAGE_PNG_VALUE))
                .andExpect(jsonPath("$.imageSource.sizeBytes").value(PNG_BYTES.length))
                .andExpect(jsonPath("$.imageSource.storageKey").doesNotExist())
                .andExpect(jsonPath("$.timestampSeconds").doesNotExist())
                .andReturn());
        long noteId = note.get("id").longValue();

        mockMvc.perform(get("/api/notes/{noteId}", noteId)
                        .cookie(ownerSession.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceType").value("IMAGE"))
                .andExpect(jsonPath("$.imageSource.id").value(image.get("sourceId").longValue()));
        patchJson(
                "/api/notes/" + noteId,
                "{\"content\":\"Updated image observation\"}",
                ownerSession)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Updated image observation"))
                .andExpect(jsonPath("$.imageSource.id").value(image.get("sourceId").longValue()));

        mockMvc.perform(get("/api/library/images/{imageId}/notes", image.get("id").longValue())
                        .cookie(ownerSession.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(noteId));

        mockMvc.perform(get("/api/notes")
                        .param("q", "exact-provenance.png")
                        .param("hasTimestamp", "false")
                        .cookie(ownerSession.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].sourceType").value("IMAGE"));

        assertThatThrownBy(() -> jdbcTemplate.update(
                "UPDATE notes SET timestamp_seconds = 0 WHERE id = ?", noteId))
                .isInstanceOf(DataAccessException.class);
        assertThat(noteRepository.findById(noteId).orElseThrow().getTimestampSeconds()).isNull();

        JsonNode task = createTask(noteId, "Image task", ownerSession);
        long taskId = task.get("id").longValue();
        assertThat(task.get("sourceStatus").stringValue()).isEqualTo("HAS_SOURCE");

        assertImageWorkspaceContext("/api/context/notes/" + noteId, ownerSession, image);
        assertImageWorkspaceContext("/api/context/tasks/" + taskId, ownerSession, image);

        deleteLibraryItem(
                "/api/library/images/" + image.get("id").longValue(), ownerSession);

        assertImagePreviewContext("/api/context/notes/" + noteId, ownerSession, image);
        assertImagePreviewContext("/api/context/tasks/" + taskId, ownerSession, image);

        mockMvc.perform(get("/api/notes/{noteId}/delete-impact", noteId)
                        .cookie(ownerSession.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taskCountToMarkSourceMissing").value(1))
                .andExpect(jsonPath("$.youtubeSourcePreserved").value(false))
                .andExpect(jsonPath("$.sourcePreserved").value(true));

        mockMvc.perform(get("/api/images/{sourceId}/content", image.get("sourceId").longValue())
                        .cookie(ownerSession.accessToken()))
                .andExpect(status().isOk())
                .andExpect(content().bytes(PNG_BYTES));
        mockMvc.perform(get("/api/images/{sourceId}/content", image.get("sourceId").longValue())
                        .cookie(otherSession.accessToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("IMAGE_CONTENT_NOT_FOUND"));

        deleteLibraryItem("/api/notes/" + noteId, ownerSession);

        assertThat(imageSourceRepository.findById(image.get("sourceId").longValue())).isPresent();
        assertThat(taskRepository.findById(taskId).orElseThrow().getSourceStatus().name())
                .isEqualTo("SOURCE_MISSING");
        assertThat(taskRepository.findById(taskId).orElseThrow().getSourceNote()).isNull();
        mockMvc.perform(get("/api/images/{sourceId}/content", image.get("sourceId").longValue())
                        .cookie(ownerSession.accessToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    void audioNoteUsesTimestampConfirmationAndRetainsExactContextAfterRemoval() throws Exception {
        Account owner = createAccount("audio-note@example.com");
        Session session = loginSession(owner.getEmail());
        JsonNode audio = createAudio(session, "https://audio.example/exact-track.mp3");
        String notesPath = "/api/library/audio/%d/notes".formatted(audio.get("id").longValue());

        postJson(
                notesPath,
                "{\"content\":\"Missing confirmation\",\"withoutTimestampConfirmed\":false}",
                session)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors.withoutTimestampConfirmed").exists());

        JsonNode timestamped = responseBody(postJson(
                notesPath,
                "{\"content\":\"Opening beat\",\"timestampSeconds\":0,\"withoutTimestampConfirmed\":false}",
                session)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceType").value("AUDIO"))
                .andExpect(jsonPath("$.timestampSeconds").value(0))
                .andExpect(jsonPath("$.audioSource.id").value(audio.get("sourceId").longValue()))
                .andExpect(jsonPath("$.audioSource.url").value("https://audio.example/exact-track.mp3"))
                .andExpect(jsonPath("$.youtubeSource").doesNotExist())
                .andExpect(jsonPath("$.imageSource").doesNotExist())
                .andReturn());
        long noteId = timestamped.get("id").longValue();

        mockMvc.perform(get("/api/notes/{noteId}", noteId)
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceType").value("AUDIO"))
                .andExpect(jsonPath("$.audioSource.id").value(audio.get("sourceId").longValue()))
                .andExpect(jsonPath("$.timestampSeconds").value(0));

        postJson(
                notesPath,
                "{\"content\":\"Whole recording\",\"withoutTimestampConfirmed\":true}",
                session)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.timestampSeconds").doesNotExist());

        mockMvc.perform(get(notesPath).cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].timestampSeconds").value(0))
                .andExpect(jsonPath("$[1].timestampSeconds").doesNotExist());

        mockMvc.perform(get("/api/notes")
                        .param("q", "exact-track.mp3")
                        .param("hasTimestamp", "true")
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(noteId));

        JsonNode task = createTask(noteId, "Audio task", session);
        long taskId = task.get("id").longValue();
        assertAudioWorkspaceContext("/api/context/notes/" + noteId, session, audio);
        assertAudioWorkspaceContext("/api/context/tasks/" + taskId, session, audio);

        deleteLibraryItem("/api/library/audio/" + audio.get("id").longValue(), session);

        assertAudioPreviewContext("/api/context/notes/" + noteId, session, audio);
        assertAudioPreviewContext("/api/context/tasks/" + taskId, session, audio);

        deleteLibraryItem("/api/notes/" + noteId, session);
        assertThat(audioSourceRepository.findById(audio.get("sourceId").longValue())).isPresent();
        assertThat(taskRepository.findById(taskId).orElseThrow().getSourceStatus().name())
                .isEqualTo("SOURCE_MISSING");
    }

    @Test
    void globalNotesQueryAcrossYoutubeImageAndAudioPreservesSourceShapes() throws Exception {
        Account account = createAccount("global-sources@example.com");
        Session session = loginSession(account.getEmail());

        LibraryVideo video = createLibraryVideo(account, "cross-source-video", "Unique video title");
        postJson(
                "/api/library/videos/%d/notes".formatted(video.getId()),
                "{\"content\":\"Video note\",\"timestampSeconds\":9,\"withoutTimestampConfirmed\":false}",
                session)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceType").value("YOUTUBE"))
                .andExpect(jsonPath("$.youtubeSource.id").value(video.getYoutubeSource().getId()));

        JsonNode image = createExternalImage(session, "https://images.example/unique-search.png");
        postJson(
                "/api/library/images/%d/notes".formatted(image.get("id").longValue()),
                "{\"content\":\"Image note\"}",
                session)
                .andExpect(status().isCreated());

        JsonNode audio = createAudio(session, "https://audio.example/unique-search.mp3");
        postJson(
                "/api/library/audio/%d/notes".formatted(audio.get("id").longValue()),
                "{\"content\":\"Audio note\",\"timestampSeconds\":4,\"withoutTimestampConfirmed\":false}",
                session)
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/notes")
                        .param("page", "0")
                        .param("size", "10")
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));
        assertSingleSearchResult(session, "Unique video title", "YOUTUBE");
        assertSingleSearchResult(session, "unique-search.png", "IMAGE");
        assertSingleSearchResult(session, "unique-search.mp3", "AUDIO");

        mockMvc.perform(get("/api/notes")
                        .param("hasTimestamp", "true")
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/notes")
                        .param("hasTimestamp", "false")
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].sourceType").value("IMAGE"));
    }

    private JsonNode uploadImage(Session session, String filename) throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", filename, MediaType.IMAGE_PNG_VALUE, PNG_BYTES);
        return responseBody(mockMvc.perform(multipart("/api/library/images/upload")
                        .file(file)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token()))
                .andExpect(status().isCreated())
                .andReturn());
    }

    private JsonNode createExternalImage(Session session, String url) throws Exception {
        return responseBody(postJson(
                "/api/library/images/url",
                "{\"url\":\"%s\"}".formatted(url),
                session)
                .andExpect(status().isCreated())
                .andReturn());
    }

    private JsonNode createAudio(Session session, String url) throws Exception {
        return responseBody(postJson(
                "/api/library/audio/url",
                "{\"url\":\"%s\"}".formatted(url),
                session)
                .andExpect(status().isCreated())
                .andReturn());
    }

    private JsonNode createTask(long noteId, String title, Session session) throws Exception {
        return responseBody(postJson(
                "/api/notes/%d/tasks".formatted(noteId),
                "{\"title\":\"%s\",\"description\":null,\"deadline\":null}".formatted(title),
                session)
                .andExpect(status().isCreated())
                .andReturn());
    }

    private LibraryVideo createLibraryVideo(Account account, String videoId, String title) {
        OffsetDateTime now = OffsetDateTime.now();
        YouTubeVideo source = youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                videoId,
                "https://www.youtube.com/watch?v=" + videoId,
                title,
                "Channel",
                null,
                120,
                null,
                YouTubeAvailabilityStatus.AVAILABLE,
                now));
        return libraryVideoRepository.saveAndFlush(LibraryVideo.create(account, source, now));
    }

    private void assertImageWorkspaceContext(String path, Session session, JsonNode image)
            throws Exception {
        mockMvc.perform(get(path).cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode").value("WORKSPACE"))
                .andExpect(jsonPath("$.libraryVideoId").doesNotExist())
                .andExpect(jsonPath("$.libraryImageId").value(image.get("id").longValue()))
                .andExpect(jsonPath("$.libraryAudioId").doesNotExist())
                .andExpect(jsonPath("$.note.imageSource.id").value(image.get("sourceId").longValue()));
    }

    private void assertImagePreviewContext(String path, Session session, JsonNode image)
            throws Exception {
        mockMvc.perform(get(path).cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode").value("SOURCE_PREVIEW"))
                .andExpect(jsonPath("$.libraryVideoId").doesNotExist())
                .andExpect(jsonPath("$.libraryImageId").doesNotExist())
                .andExpect(jsonPath("$.libraryAudioId").doesNotExist())
                .andExpect(jsonPath("$.note.imageSource.id").value(image.get("sourceId").longValue()));
    }

    private void assertAudioWorkspaceContext(String path, Session session, JsonNode audio)
            throws Exception {
        mockMvc.perform(get(path).cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode").value("WORKSPACE"))
                .andExpect(jsonPath("$.libraryVideoId").doesNotExist())
                .andExpect(jsonPath("$.libraryImageId").doesNotExist())
                .andExpect(jsonPath("$.libraryAudioId").value(audio.get("id").longValue()))
                .andExpect(jsonPath("$.note.audioSource.id").value(audio.get("sourceId").longValue()))
                .andExpect(jsonPath("$.note.timestampSeconds").value(0));
    }

    private void assertAudioPreviewContext(String path, Session session, JsonNode audio)
            throws Exception {
        mockMvc.perform(get(path).cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode").value("SOURCE_PREVIEW"))
                .andExpect(jsonPath("$.libraryVideoId").doesNotExist())
                .andExpect(jsonPath("$.libraryImageId").doesNotExist())
                .andExpect(jsonPath("$.libraryAudioId").doesNotExist())
                .andExpect(jsonPath("$.note.audioSource.id").value(audio.get("sourceId").longValue()))
                .andExpect(jsonPath("$.note.timestampSeconds").value(0));
    }

    private void assertSingleSearchResult(Session session, String query, String sourceType)
            throws Exception {
        mockMvc.perform(get("/api/notes")
                        .param("q", query)
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].sourceType").value(sourceType));
    }

    private void deleteLibraryItem(String path, Session session) throws Exception {
        mockMvc.perform(delete(path)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token()))
                .andExpect(status().isNoContent());
    }

    private org.springframework.test.web.servlet.ResultActions postJson(
            String path,
            String body,
            Session session) throws Exception {
        return mockMvc.perform(post(path)
                .cookie(session.accessToken(), session.csrf().cookie())
                .header(session.csrf().headerName(), session.csrf().token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private org.springframework.test.web.servlet.ResultActions patchJson(
            String path,
            String body,
            Session session) throws Exception {
        return mockMvc.perform(patch(path)
                .cookie(session.accessToken(), session.csrf().cookie())
                .header(session.csrf().headerName(), session.csrf().token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private JsonNode responseBody(MvcResult result) throws IOException {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
    }

    private Session loginSession(String email) throws Exception {
        CsrfExchange loginCsrf = fetchCsrf();
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .cookie(loginCsrf.cookie())
                        .header(loginCsrf.headerName(), loginCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();
        Cookie accessToken = result.getResponse().getCookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME);
        assertThat(accessToken).isNotNull();
        return new Session(accessToken, fetchCsrf(accessToken));
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

    private record Session(Cookie accessToken, CsrfExchange csrf) {
    }

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }
}
