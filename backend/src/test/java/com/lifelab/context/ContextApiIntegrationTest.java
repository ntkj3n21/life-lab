package com.lifelab.context;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
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
class ContextApiIntegrationTest {

    private static final String PASSWORD = "Password123";

    private static final OffsetDateTime BASE_TIME =
            OffsetDateTime.parse("2026-08-12T00:00:00Z");

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
    void contextEndpointsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/context/notes/{noteId}", 1L))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        mockMvc.perform(get("/api/context/tasks/{taskId}", 1L))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void noteInCurrentLibraryResolvesWorkspaceWithExactSourceAndTimestamp()
            throws Exception {

        Account owner = createAccount("context-workspace@example.com");

        YouTubeVideo source = createSource(
                "context-workspace",
                YouTubeAvailabilityStatus.AVAILABLE);

        LibraryVideo libraryVideo =
                createLibraryVideo(owner, source);

        Long noteId = insertNote(
                owner.getId(),
                source.getId(),
                "Workspace context",
                125);

        when(youTubeMetadataClient.resolve(source.getYoutubeVideoId()))
                .thenReturn(resolvedAvailable(source.getYoutubeVideoId()));

        Cookie token = login(owner.getEmail());

        mockMvc.perform(
                        get("/api/context/notes/{noteId}", noteId)
                                .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode")
                        .value("WORKSPACE"))
                .andExpect(jsonPath("$.task").doesNotExist())
                .andExpect(jsonPath("$.note.id").value(noteId))
                .andExpect(jsonPath("$.note.content")
                        .value("Workspace context"))
                .andExpect(jsonPath("$.note.timestampSeconds")
                        .value(125))
                .andExpect(jsonPath(
                        "$.note.youtubeSource.id")
                        .value(source.getId()))
                .andExpect(jsonPath(
                        "$.note.youtubeSource.youtubeVideoId")
                        .value("context-workspace"))
                .andExpect(jsonPath("$.libraryVideoId")
                        .value(libraryVideo.getId()));
    }

    @Test
    void deletedLibraryEntryResolvesSourcePreviewAndDoesNotGuessTimestamp()
            throws Exception {

        Account owner = createAccount("context-preview@example.com");

        YouTubeVideo source = createSource(
                "context-preview",
                YouTubeAvailabilityStatus.AVAILABLE);

        LibraryVideo libraryVideo =
                createLibraryVideo(owner, source);

        Long noteId = insertNote(
                owner.getId(),
                source.getId(),
                "Preserved source",
                null);

        libraryVideoRepository.deleteById(libraryVideo.getId());
        libraryVideoRepository.flush();

        when(youTubeMetadataClient.resolve(source.getYoutubeVideoId()))
                .thenReturn(resolvedAvailable(source.getYoutubeVideoId()));

        Cookie token = login(owner.getEmail());

        mockMvc.perform(
                        get("/api/context/notes/{noteId}", noteId)
                                .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode")
                        .value("SOURCE_PREVIEW"))
                .andExpect(jsonPath("$.task").doesNotExist())
                .andExpect(jsonPath("$.note.id").value(noteId))
                .andExpect(jsonPath("$.note.content")
                        .value("Preserved source"))
                .andExpect(jsonPath("$.note.timestampSeconds")
                        .doesNotExist())
                .andExpect(jsonPath(
                        "$.note.youtubeSource.id")
                        .value(source.getId()))
                .andExpect(jsonPath("$.libraryVideoId")
                        .doesNotExist());

        assertThat(count("notes")).isEqualTo(1);
        assertThat(count("youtube_videos")).isEqualTo(1);
        assertThat(count("library_videos")).isZero();
        assertThat(count("watch_sessions")).isZero();
    }

    @Test
    void unavailableYoutubeSourcePreservesContextAndResolvesVideoUnavailable()
            throws Exception {

        Account owner = createAccount(
                "context-unavailable@example.com");

        YouTubeVideo source = createSource(
                "context-unavailable",
                YouTubeAvailabilityStatus.UNAVAILABLE);

        createLibraryVideo(owner, source);

        Long noteId = insertNote(
                owner.getId(),
                source.getId(),
                "Unavailable source context",
                73);

        Long taskId = insertTask(
                owner.getId(),
                noteId,
                "HAS_SOURCE",
                "Keep context");

        Cookie token = login(owner.getEmail());

        mockMvc.perform(
                        get("/api/context/tasks/{taskId}", taskId)
                                .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode")
                        .value("VIDEO_UNAVAILABLE"))
                .andExpect(jsonPath("$.task.id").value(taskId))
                .andExpect(jsonPath("$.task.sourceStatus")
                        .value("HAS_SOURCE"))
                .andExpect(jsonPath("$.task.sourceNoteId")
                        .value(noteId))
                .andExpect(jsonPath("$.note.id").value(noteId))
                .andExpect(jsonPath("$.note.timestampSeconds")
                        .value(73))
                .andExpect(jsonPath(
                        "$.note.youtubeSource.availabilityStatus")
                        .value("UNAVAILABLE"))
                .andExpect(jsonPath("$.libraryVideoId")
                        .doesNotExist());

        assertThat(count("tasks")).isEqualTo(1);
        assertThat(count("notes")).isEqualTo(1);
        assertThat(count("watch_sessions")).isZero();

        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void independentAndMissingSourceTasksResolveDifferentModes()
            throws Exception {

        Account owner = createAccount(
                "context-task-modes@example.com");

        Long independentId = insertTask(
                owner.getId(),
                null,
                "INDEPENDENT",
                "Independent task");

        Long missingId = insertTask(
                owner.getId(),
                null,
                "SOURCE_MISSING",
                "Missing source task");

        Cookie token = login(owner.getEmail());

        mockMvc.perform(
                        get("/api/context/tasks/{taskId}",
                                independentId)
                                .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode")
                        .value("NO_SOURCE"))
                .andExpect(jsonPath("$.task.id")
                        .value(independentId))
                .andExpect(jsonPath("$.task.sourceStatus")
                        .value("INDEPENDENT"))
                .andExpect(jsonPath("$.note").doesNotExist())
                .andExpect(jsonPath("$.libraryVideoId")
                        .doesNotExist());

        mockMvc.perform(
                        get("/api/context/tasks/{taskId}",
                                missingId)
                                .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode")
                        .value("SOURCE_MISSING"))
                .andExpect(jsonPath("$.task.id")
                        .value(missingId))
                .andExpect(jsonPath("$.task.sourceStatus")
                        .value("SOURCE_MISSING"))
                .andExpect(jsonPath("$.note").doesNotExist())
                .andExpect(jsonPath("$.libraryVideoId")
                        .doesNotExist());

        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void sourcedTaskFollowsExactRecordedNoteAndNeverAnotherSimilarNote()
            throws Exception {

        Account owner = createAccount(
                "context-exact-source@example.com");

        YouTubeVideo correctSource = createSource(
                "context-correct",
                YouTubeAvailabilityStatus.AVAILABLE);

        YouTubeVideo similarSource = createSource(
                "context-similar",
                YouTubeAvailabilityStatus.AVAILABLE);

        Long correctNoteId = insertNote(
                owner.getId(),
                correctSource.getId(),
                "Same looking content",
                40);

        Long similarNoteId = insertNote(
                owner.getId(),
                similarSource.getId(),
                "Same looking content",
                99);

        Long taskId = insertTask(
                owner.getId(),
                correctNoteId,
                "HAS_SOURCE",
                "Exact chain task");

        when(youTubeMetadataClient.resolve(correctSource.getYoutubeVideoId()))
                .thenReturn(resolvedAvailable(correctSource.getYoutubeVideoId()));

        Cookie token = login(owner.getEmail());

        mockMvc.perform(
                        get("/api/context/tasks/{taskId}", taskId)
                                .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode")
                        .value("SOURCE_PREVIEW"))
                .andExpect(jsonPath("$.task.id").value(taskId))
                .andExpect(jsonPath("$.task.sourceNoteId")
                        .value(correctNoteId))
                .andExpect(jsonPath("$.note.id")
                        .value(correctNoteId))
                .andExpect(jsonPath("$.note.id")
                        .value(org.hamcrest.Matchers.not(
                                similarNoteId.intValue())))
                .andExpect(jsonPath(
                        "$.note.youtubeSource.id")
                        .value(correctSource.getId()))
                .andExpect(jsonPath("$.note.timestampSeconds")
                        .value(40));
    }

    @Test
    void anotherAccountsLibraryDoesNotTurnSourcePreviewIntoWorkspace()
            throws Exception {

        Account owner = createAccount(
                "context-owner@example.com");

        Account other = createAccount(
                "context-other-library@example.com");

        YouTubeVideo sharedSource = createSource(
                "context-shared",
                YouTubeAvailabilityStatus.AVAILABLE);

        createLibraryVideo(other, sharedSource);

        Long noteId = insertNote(
                owner.getId(),
                sharedSource.getId(),
                "Owner note",
                15);

        when(youTubeMetadataClient.resolve(sharedSource.getYoutubeVideoId()))
                .thenReturn(resolvedAvailable(sharedSource.getYoutubeVideoId()));

        Cookie token = login(owner.getEmail());

        mockMvc.perform(
                        get("/api/context/notes/{noteId}", noteId)
                                .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode")
                        .value("SOURCE_PREVIEW"))
                .andExpect(jsonPath("$.note.id")
                        .value(noteId))
                .andExpect(jsonPath("$.libraryVideoId")
                        .doesNotExist());
    }

    @Test
    void unknownAndCrossAccountResourcesUseSafeNotFoundResponses()
            throws Exception {

        Account owner = createAccount(
                "context-private-owner@example.com");

        Account other = createAccount(
                "context-private-other@example.com");

        YouTubeVideo source = createSource(
                "context-private",
                YouTubeAvailabilityStatus.AVAILABLE);

        Long foreignNoteId = insertNote(
                other.getId(),
                source.getId(),
                "Private note",
                5);

        Long foreignTaskId = insertTask(
                other.getId(),
                foreignNoteId,
                "HAS_SOURCE",
                "Private task");

        Cookie token = login(owner.getEmail());

        for (Long noteId : new Long[] {
                999999L,
                foreignNoteId
        }) {
            mockMvc.perform(
                            get("/api/context/notes/{noteId}",
                                    noteId)
                                    .cookie(token))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code")
                            .value("NOTE_NOT_FOUND"));
        }

        for (Long taskId : new Long[] {
                999999L,
                foreignTaskId
        }) {
            mockMvc.perform(
                            get("/api/context/tasks/{taskId}",
                                    taskId)
                                    .cookie(token))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code")
                            .value("TASK_NOT_FOUND"));
        }

        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void resolvingContextIsReadOnlyAndCreatesNoWatchSession()
            throws Exception {

        Account owner = createAccount(
                "context-readonly@example.com");

        YouTubeVideo source = createSource(
                "context-readonly",
                YouTubeAvailabilityStatus.AVAILABLE);

        createLibraryVideo(owner, source);

        Long noteId = insertNote(
                owner.getId(),
                source.getId(),
                "Read only context",
                20);

        Long taskId = insertTask(
                owner.getId(),
                noteId,
                "HAS_SOURCE",
                "Read only task");

        when(youTubeMetadataClient.resolve(source.getYoutubeVideoId()))
                .thenReturn(resolvedAvailable(source.getYoutubeVideoId()));

        Map<String, Long> before = tableCounts();

        Map<String, Object> noteBefore =
                jdbcTemplate.queryForMap(
                        "SELECT * FROM notes WHERE id = ?",
                        noteId);

        Map<String, Object> taskBefore =
                jdbcTemplate.queryForMap(
                        "SELECT * FROM tasks WHERE id = ?",
                        taskId);

        Cookie token = login(owner.getEmail());

        mockMvc.perform(
                        get("/api/context/notes/{noteId}", noteId)
                                .cookie(token))
                .andExpect(status().isOk());

        mockMvc.perform(
                        get("/api/context/tasks/{taskId}", taskId)
                                .cookie(token))
                .andExpect(status().isOk());

        assertThat(tableCounts()).isEqualTo(before);

        assertThat(jdbcTemplate.queryForMap(
                "SELECT * FROM notes WHERE id = ?",
                noteId))
                .isEqualTo(noteBefore);

        assertThat(jdbcTemplate.queryForMap(
                "SELECT * FROM tasks WHERE id = ?",
                taskId))
                .isEqualTo(taskBefore);

        assertThat(count("watch_sessions")).isZero();
    }

    @Test
    void storedAvailableSourceThatYoutubeNoLongerFindsResolvesVideoUnavailable()
            throws Exception {

        Account owner = createAccount(
                "context-stale-available@example.com");

        YouTubeVideo source = createSource(
                "context-stale-available",
                YouTubeAvailabilityStatus.AVAILABLE);

        LibraryVideo libraryVideo =
                createLibraryVideo(owner, source);

        Long noteId = insertNote(
                owner.getId(),
                source.getId(),
                "Historical context remains",
                64);

        Long taskId = insertTask(
                owner.getId(),
                noteId,
                "HAS_SOURCE",
                "Historical task");

        when(youTubeMetadataClient.resolve(source.getYoutubeVideoId()))
                .thenThrow(new YouTubeVideoNotFoundException());

        Map<String, Long> before = tableCounts();

        Cookie token = login(owner.getEmail());

        mockMvc.perform(
                        get("/api/context/tasks/{taskId}", taskId)
                                .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.navigationMode")
                        .value("VIDEO_UNAVAILABLE"))
                .andExpect(jsonPath("$.task.id")
                        .value(taskId))
                .andExpect(jsonPath("$.task.sourceStatus")
                        .value("HAS_SOURCE"))
                .andExpect(jsonPath("$.task.sourceNoteId")
                        .value(noteId))
                .andExpect(jsonPath("$.note.id")
                        .value(noteId))
                .andExpect(jsonPath("$.note.timestampSeconds")
                        .value(64))
                .andExpect(jsonPath(
                        "$.note.youtubeSource.youtubeVideoId")
                        .value("context-stale-available"))
                .andExpect(jsonPath(
                        "$.note.youtubeSource.availabilityStatus")
                        .value("AVAILABLE"))
                .andExpect(jsonPath("$.libraryVideoId")
                        .doesNotExist());

        assertThat(tableCounts()).isEqualTo(before);
        assertThat(count("library_videos")).isEqualTo(1);
        assertThat(libraryVideoRepository.existsById(
                libraryVideo.getId())).isTrue();
        assertThat(count("watch_sessions")).isZero();
    }

    @Test
    void youtubeServiceFailureReturns502WithoutMutatingContext()
            throws Exception {

        Account owner = createAccount(
                "context-youtube-failure@example.com");

        YouTubeVideo source = createSource(
                "context-youtube-failure",
                YouTubeAvailabilityStatus.AVAILABLE);

        createLibraryVideo(owner, source);

        Long noteId = insertNote(
                owner.getId(),
                source.getId(),
                "Context must survive service failure",
                91);

        Long taskId = insertTask(
                owner.getId(),
                noteId,
                "HAS_SOURCE",
                "Service failure task");

        when(youTubeMetadataClient.resolve(source.getYoutubeVideoId()))
                .thenThrow(
                        new YouTubeServiceException(
                                "temporary upstream failure"));

        Map<String, Long> before = tableCounts();

        Map<String, Object> noteBefore =
                jdbcTemplate.queryForMap(
                        "SELECT * FROM notes WHERE id = ?",
                        noteId);

        Map<String, Object> taskBefore =
                jdbcTemplate.queryForMap(
                        "SELECT * FROM tasks WHERE id = ?",
                        taskId);

        Cookie token = login(owner.getEmail());

        mockMvc.perform(
                        get("/api/context/tasks/{taskId}", taskId)
                                .cookie(token))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code")
                        .value("YOUTUBE_SERVICE_ERROR"))
                .andExpect(jsonPath("$.message")
                        .value("YouTube service is unavailable."));

        assertThat(tableCounts()).isEqualTo(before);

        assertThat(jdbcTemplate.queryForMap(
                "SELECT * FROM notes WHERE id = ?",
                noteId))
                .isEqualTo(noteBefore);

        assertThat(jdbcTemplate.queryForMap(
                "SELECT * FROM tasks WHERE id = ?",
                taskId))
                .isEqualTo(taskBefore);

        assertThat(count("watch_sessions")).isZero();
    }

    private Account createAccount(String email) {
        return accountRepository.saveAndFlush(
                Account.create(
                        email,
                        passwordEncoder.encode(PASSWORD),
                        "Test User",
                        BASE_TIME));
    }

    private YouTubeVideo createSource(
            String youtubeVideoId,
            YouTubeAvailabilityStatus availabilityStatus) {

        return youTubeVideoRepository.saveAndFlush(
                YouTubeVideo.create(
                        youtubeVideoId,
                        "https://www.youtube.com/watch?v="
                                + youtubeVideoId,
                        "Title",
                        "Channel",
                        "https://image.example/"
                                + youtubeVideoId + ".jpg",
                        300,
                        BASE_TIME.minusDays(10),
                        availabilityStatus,
                        BASE_TIME));
    }

    private LibraryVideo createLibraryVideo(
            Account account,
            YouTubeVideo source) {

        return libraryVideoRepository.saveAndFlush(
                LibraryVideo.create(
                        account,
                        source,
                        BASE_TIME));
    }

    private ResolvedYouTubeVideo resolvedAvailable(
            String youtubeVideoId) {

        return new ResolvedYouTubeVideo(
                youtubeVideoId,
                "https://www.youtube.com/watch?v="
                        + youtubeVideoId,
                "Resolved Title",
                "Resolved Channel",
                "https://image.example/"
                        + youtubeVideoId + ".jpg",
                300,
                BASE_TIME.minusDays(10),
                YouTubeAvailabilityStatus.AVAILABLE);
    }

    private Long insertNote(
            Long accountId,
            Long youtubeSourceId,
            String content,
            Integer timestampSeconds) {

        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id,
                    youtube_source_id,
                    content,
                    timestamp_seconds,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                accountId,
                youtubeSourceId,
                content,
                timestampSeconds,
                BASE_TIME,
                BASE_TIME);
    }

    private Long insertTask(
            Long accountId,
            Long sourceNoteId,
            String sourceStatus,
            String title) {

        return jdbcTemplate.queryForObject("""
                INSERT INTO tasks (
                    account_id,
                    source_note_id,
                    source_status,
                    title,
                    description,
                    status,
                    deadline,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, NULL, 'NOT_STARTED', NULL, ?, ?)
                RETURNING id
                """,
                Long.class,
                accountId,
                sourceNoteId,
                sourceStatus,
                title,
                BASE_TIME,
                BASE_TIME);
    }

    private Map<String, Long> tableCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();

        for (String table : new String[] {
                "accounts",
                "youtube_videos",
                "library_videos",
                "tags",
                "library_video_tags",
                "watch_sessions",
                "notes",
                "tasks"
        }) {
            counts.put(table, count(table));
        }

        return counts;
    }

    private long count(String table) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table,
                Long.class);
    }

    private Cookie login(String email) throws Exception {
        CsrfExchange csrf = fetchCsrf();

        MvcResult result = mockMvc.perform(
                        post("/api/auth/login")
                                .cookie(csrf.cookie())
                                .header(
                                        csrf.headerName(),
                                        csrf.token())
                                .contentType(
                                        MediaType.APPLICATION_JSON)
                                .content("""
                                        {
                                          "email":"%s",
                                          "password":"%s"
                                        }
                                        """.formatted(
                                        email,
                                        PASSWORD)))
                .andExpect(status().isOk())
                .andReturn();

        Cookie accessToken =
                result.getResponse()
                        .getCookie(
                                JwtCookieService
                                        .ACCESS_TOKEN_COOKIE_NAME);

        assertThat(accessToken).isNotNull();

        return accessToken;
    }

    private CsrfExchange fetchCsrf(Cookie... cookies)
            throws Exception {

        var request = get("/api/auth/csrf");

        if (cookies.length > 0) {
            request.cookie(cookies);
        }

        MvcResult result = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn();

        MockHttpServletResponse response =
                result.getResponse();

        Cookie csrfCookie =
                response.getCookie("XSRF-TOKEN");

        JsonNode body =
                objectMapper.readTree(
                        response.getContentAsByteArray());

        assertThat(csrfCookie).isNotNull();

        return new CsrfExchange(
                csrfCookie,
                csrfCookie.getValue(),
                body.get("headerName").stringValue());
    }

    private record CsrfExchange(
            Cookie cookie,
            String token,
            String headerName) {
    }
}