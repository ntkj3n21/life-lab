package com.lifelab.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
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
import com.lifelab.video.domain.Tag;
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
import com.lifelab.video.repository.LibraryVideoRepository;
import com.lifelab.video.repository.TagRepository;
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
class TaskDeleteApiIntegrationTest {

    private static final String PASSWORD = "Password123";
    private static final OffsetDateTime BASE_TIME = OffsetDateTime.parse("2026-08-12T12:00:00Z");

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
    private TagRepository tagRepository;

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
    void deleteRequiresAuthenticationAndValidCsrf() throws Exception {
        Account owner = createAccount("task-delete-security@example.com");
        Long taskId = insertTask(owner.getId(), null, "INDEPENDENT", "Task");
        CsrfExchange guestCsrf = fetchCsrf();

        deleteWithCsrf(taskId, null, guestCsrf)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Cookie accessToken = login(owner.getEmail());
        mockMvc.perform(delete("/api/tasks/{taskId}", taskId).cookie(accessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(count("tasks")).isEqualTo(1);
    }

    @Test
    void ownerDeletesIndependentTaskAndReadModelReflectsDeletion() throws Exception {
        Account owner = createAccount("task-delete-independent@example.com");
        Long deletedId = insertTask(owner.getId(), null, "INDEPENDENT", "Delete me");
        Long retainedId = insertTask(owner.getId(), null, "INDEPENDENT", "Keep me");
        Map<String, Object> retainedBefore = row("tasks", retainedId);
        AuthenticatedSession session = authenticate(owner.getEmail());

        deleteAuthenticated(deletedId, session).andExpect(status().isNoContent());

        assertThat(taskExists(deletedId)).isFalse();
        assertThat(row("tasks", retainedId)).isEqualTo(retainedBefore);
        mockMvc.perform(get("/api/tasks/{taskId}", deletedId).cookie(session.accessToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
        mockMvc.perform(get("/api/tasks").cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(retainedId));
        mockMvc.perform(get("/api/tasks").param("q", "delete me").cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void deletingSourcedTaskPreservesExactSourceAndAllRelatedData() throws Exception {
        Account owner = createAccount("task-delete-sourced@example.com");
        YouTubeVideo source = createSource("task-delete-source");
        LibraryVideo video = libraryVideoRepository.saveAndFlush(LibraryVideo.create(owner, source, BASE_TIME));
        Long noteId = insertNote(owner.getId(), source.getId(), "Original context");
        Long deletedTaskId = insertTask(owner.getId(), noteId, "HAS_SOURCE", "Delete sourced");
        Long retainedTaskId = insertTask(owner.getId(), noteId, "HAS_SOURCE", "Retain sourced");
        Tag tag = tagRepository.saveAndFlush(Tag.create(owner, "Context", "context", BASE_TIME));
        jdbcTemplate.update(
                "INSERT INTO library_video_tags (library_video_id, tag_id) VALUES (?, ?)",
                video.getId(), tag.getId());
        jdbcTemplate.update("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, ?, ?, ?, 30, 'VALID')
                """, video.getId(), BASE_TIME, BASE_TIME.plusMinutes(1), BASE_TIME.plusMinutes(1));
        Map<String, Object> noteBefore = row("notes", noteId);
        Map<String, Object> sourceBefore = row("youtube_videos", source.getId());
        Map<String, Object> videoBefore = row("library_videos", video.getId());
        Map<String, Object> retainedTaskBefore = row("tasks", retainedTaskId);
        Map<String, Object> tagBefore = row("tags", tag.getId());
        Map<String, Object> watchBefore = jdbcTemplate.queryForMap("SELECT * FROM watch_sessions");
        Map<String, Object> linkBefore = jdbcTemplate.queryForMap("SELECT * FROM library_video_tags");
        AuthenticatedSession session = authenticate(owner.getEmail());

        deleteAuthenticated(deletedTaskId, session).andExpect(status().isNoContent());

        assertThat(taskExists(deletedTaskId)).isFalse();
        assertThat(row("notes", noteId)).isEqualTo(noteBefore);
        assertThat(row("youtube_videos", source.getId())).isEqualTo(sourceBefore);
        assertThat(row("library_videos", video.getId())).isEqualTo(videoBefore);
        assertThat(row("tasks", retainedTaskId)).isEqualTo(retainedTaskBefore);
        assertThat(row("tags", tag.getId())).isEqualTo(tagBefore);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM watch_sessions")).isEqualTo(watchBefore);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM library_video_tags")).isEqualTo(linkBefore);

        postTaskFromNote(noteId, session, "Task recreated")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceNoteId").value(noteId))
                .andExpect(jsonPath("$.sourceStatus").value("HAS_SOURCE"));
        assertThat(count("tasks")).isEqualTo(2);
        assertThat(row("notes", noteId)).isEqualTo(noteBefore);
        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void sourceMissingTaskDeletesNormallyWithoutRepairAttempt() throws Exception {
        Account owner = createAccount("task-delete-missing@example.com");
        Long taskId = insertTask(owner.getId(), null, "SOURCE_MISSING", "Missing source");
        AuthenticatedSession session = authenticate(owner.getEmail());

        deleteAuthenticated(taskId, session).andExpect(status().isNoContent());

        assertThat(taskExists(taskId)).isFalse();
        assertThat(count("tasks")).isZero();
        assertThat(count("notes")).isZero();
        assertThat(count("youtube_videos")).isZero();
        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void unknownAndCrossAccountDeletesReturnSameNotFoundWithoutMutation() throws Exception {
        Account owner = createAccount("task-delete-private-owner@example.com");
        Account other = createAccount("task-delete-private-other@example.com");
        Long ownerTaskId = insertTask(owner.getId(), null, "INDEPENDENT", "Owner task");
        Long foreignTaskId = insertTask(other.getId(), null, "INDEPENDENT", "Foreign task");
        Map<String, Object> ownerBefore = row("tasks", ownerTaskId);
        Map<String, Object> foreignBefore = row("tasks", foreignTaskId);
        AuthenticatedSession session = authenticate(owner.getEmail());

        for (Long taskId : new Long[] {999999L, foreignTaskId}) {
            deleteAuthenticated(taskId, session)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
        }

        assertThat(count("tasks")).isEqualTo(2);
        assertThat(row("tasks", ownerTaskId)).isEqualTo(ownerBefore);
        assertThat(row("tasks", foreignTaskId)).isEqualTo(foreignBefore);
    }

    private Account createAccount(String email) {
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                BASE_TIME));
    }

    private YouTubeVideo createSource(String id) {
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                id,
                "https://www.youtube.com/watch?v=" + id,
                "Title",
                "Channel",
                null,
                100,
                BASE_TIME,
                YouTubeAvailabilityStatus.AVAILABLE,
                BASE_TIME));
    }

    private Long insertNote(Long accountId, Long sourceId, String content) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, ?, NULL, ?, ?)
                RETURNING id
                """, Long.class, accountId, sourceId, content, BASE_TIME, BASE_TIME);
    }

    private Long insertTask(Long accountId, Long noteId, String sourceStatus, String title) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, ?, ?, ?, NULL, 'NOT_STARTED', NULL, ?, ?)
                RETURNING id
                """, Long.class, accountId, noteId, sourceStatus, title, BASE_TIME, BASE_TIME);
    }

    private org.springframework.test.web.servlet.ResultActions deleteAuthenticated(
            Long taskId,
            AuthenticatedSession session) throws Exception {
        return deleteWithCsrf(taskId, session.accessToken(), session.csrf());
    }

    private org.springframework.test.web.servlet.ResultActions deleteWithCsrf(
            Long taskId,
            Cookie accessToken,
            CsrfExchange csrf) throws Exception {
        var request = delete("/api/tasks/{taskId}", taskId)
                .cookie(csrf.cookie())
                .header(csrf.headerName(), csrf.token());
        if (accessToken != null) {
            request.cookie(accessToken);
        }
        return mockMvc.perform(request);
    }

    private org.springframework.test.web.servlet.ResultActions postTaskFromNote(
            Long noteId,
            AuthenticatedSession session,
            String title) throws Exception {
        return mockMvc.perform(post("/api/notes/{noteId}/tasks", noteId)
                .cookie(session.accessToken(), session.csrf().cookie())
                .header(session.csrf().headerName(), session.csrf().token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title":"%s","description":null,"deadline":null}
                        """.formatted(title)));
    }

    private Map<String, Object> row(String table, Long id) {
        return jdbcTemplate.queryForMap("SELECT * FROM " + table + " WHERE id = ?", id);
    }

    private boolean taskExists(Long taskId) {
        return jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM tasks WHERE id = ?)", Boolean.class, taskId);
    }

    private long count(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
    }

    private AuthenticatedSession authenticate(String email) throws Exception {
        Cookie accessToken = login(email);
        return new AuthenticatedSession(accessToken, fetchCsrf(accessToken));
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

    private record AuthenticatedSession(Cookie accessToken, CsrfExchange csrf) {
    }

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }
}
