package com.lifelab.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
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
class TaskUpdateApiIntegrationTest {

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
    void bothPatchEndpointsRequireAuthenticationAndValidCsrf() throws Exception {
        Account owner = createAccount("task-update-security@example.com");
        Long taskId = insertTask(owner.getId(), null, "INDEPENDENT", "Task", "Description",
                "NOT_STARTED", null, BASE_TIME);
        String detailsBody = """
                {"title":"Updated","description":null,"deadline":null}
                """;
        String statusBody = """
                {"status":"COMPLETED"}
                """;
        CsrfExchange guestCsrf = fetchCsrf();

        patchWithCsrf("/api/tasks/{id}", taskId, detailsBody, null, guestCsrf)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        patchWithCsrf("/api/tasks/{id}/status", taskId, statusBody, null, guestCsrf)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Cookie accessToken = login(owner.getEmail());
        mockMvc.perform(patch("/api/tasks/{id}", taskId)
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(detailsBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        mockMvc.perform(patch("/api/tasks/{id}/status", taskId)
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertTaskFields(taskId, "Task", "Description", "NOT_STARTED", null);
    }

    @Test
    void ownerUpdatesCompleteDetailsClearsNullableFieldsAndM1ReadsChanges() throws Exception {
        Account owner = createAccount("task-update-details@example.com");
        Long taskId = insertTask(owner.getId(), null, "INDEPENDENT", "Original", "Original description",
                "NOT_STARTED", LocalDate.of(2026, 8, 20), BASE_TIME);
        AuthenticatedSession session = authenticate(owner.getEmail());
        OffsetDateTime before = OffsetDateTime.now().minusSeconds(1);

        patchAuthenticated("/api/tasks/{id}", taskId, """
                {"title":"Updated task","description":"Updated description","deadline":"2000-01-01"}
                """, session)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated task"))
                .andExpect(jsonPath("$.description").value("Updated description"))
                .andExpect(jsonPath("$.deadline").value("2000-01-01"))
                .andExpect(jsonPath("$.status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.sourceStatus").value("INDEPENDENT"));

        OffsetDateTime after = OffsetDateTime.now().plusSeconds(1);
        assertTaskFields(taskId, "Updated task", "Updated description", "NOT_STARTED",
                LocalDate.of(2000, 1, 1));
        assertTimestamps(taskId, before, after);

        patchAuthenticated("/api/tasks/{id}", taskId, """
                {"title":"Cleared task","description":null,"deadline":null}
                """, session)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.deadline").doesNotExist());
        assertTaskFields(taskId, "Cleared task", null, "NOT_STARTED", null);

        mockMvc.perform(get("/api/tasks/{id}", taskId).cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Cleared task"));
        mockMvc.perform(get("/api/tasks").param("q", "cleared").cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(taskId));
    }

    @Test
    void invalidTitlesReturnValidationErrorWithoutMutation() throws Exception {
        Account owner = createAccount("task-update-validation@example.com");
        Long taskId = insertTask(owner.getId(), null, "INDEPENDENT", "Original", "Description",
                "NOT_STARTED", LocalDate.of(2026, 8, 20), BASE_TIME);
        AuthenticatedSession session = authenticate(owner.getEmail());
        Map<String, Object> before = taskRow(taskId);

        for (String title : new String[] {"", "   \t", "\u00A0\u2003", "a".repeat(256)}) {
            String body = objectMapper.writeValueAsString(Map.of(
                    "title", title,
                    "description", "Changed"));
            patchAuthenticated("/api/tasks/{id}", taskId, body, session)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fieldErrors.title").exists());
        }
        assertThat(taskRow(taskId)).isEqualTo(before);
    }

    @Test
    void unknownAndCrossAccountTasksUseSameSafeNotFoundWithoutMutation() throws Exception {
        Account owner = createAccount("task-update-private-owner@example.com");
        Account other = createAccount("task-update-private-other@example.com");
        Long foreignId = insertTask(other.getId(), null, "INDEPENDENT", "Foreign", null,
                "NOT_STARTED", null, BASE_TIME);
        AuthenticatedSession session = authenticate(owner.getEmail());
        Map<String, Object> before = taskRow(foreignId);

        for (Long taskId : new Long[] {999999L, foreignId}) {
            patchAuthenticated("/api/tasks/{id}", taskId, """
                    {"title":"Changed","description":null,"deadline":null}
                    """, session)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
            patchAuthenticated("/api/tasks/{id}/status", taskId, """
                    {"status":"COMPLETED"}
                    """, session)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
        }
        assertThat(taskRow(foreignId)).isEqualTo(before);
    }

    @Test
    void detailEditCannotOverrideAccountSourceOrStatus() throws Exception {
        Account owner = createAccount("task-update-source-owner@example.com");
        Account other = createAccount("task-update-source-other@example.com");
        YouTubeVideo source = createSource("task-update-source", YouTubeAvailabilityStatus.AVAILABLE);
        Long exactNoteId = insertNote(owner.getId(), source.getId(), "Exact source");
        Long otherNoteId = insertNote(owner.getId(), source.getId(), "Other source");
        Long taskId = insertTask(owner.getId(), exactNoteId, "HAS_SOURCE", "Original", null,
                "IN_PROGRESS", null, BASE_TIME);
        AuthenticatedSession session = authenticate(owner.getEmail());

        patchAuthenticated("/api/tasks/{id}", taskId, """
                {
                  "title":"Updated",
                  "description":null,
                  "deadline":null,
                  "accountId":%d,
                  "sourceNoteId":%d,
                  "sourceStatus":"INDEPENDENT",
                  "status":"COMPLETED"
                }
                """.formatted(other.getId(), otherNoteId), session)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceNoteId").value(exactNoteId))
                .andExpect(jsonPath("$.sourceStatus").value("HAS_SOURCE"))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        Map<String, Object> task = taskRow(taskId);
        assertThat(number(task, "account_id")).isEqualTo(owner.getId());
        assertThat(number(task, "source_note_id")).isEqualTo(exactNoteId);
        assertThat(task.get("source_status")).isEqualTo("HAS_SOURCE");
        assertThat(task.get("status")).isEqualTo("IN_PROGRESS");
    }

    @Test
    void statusEndpointAllowsEveryDirectTransitionAndPreservesContent() throws Exception {
        Account owner = createAccount("task-status-update@example.com");
        Long taskId = insertTask(owner.getId(), null, "INDEPENDENT", "Task", "Description",
                "NOT_STARTED", LocalDate.of(2026, 8, 20), BASE_TIME);
        AuthenticatedSession session = authenticate(owner.getEmail());
        Map<String, Object> original = taskRow(taskId);

        for (String next : new String[] {
                "IN_PROGRESS", "COMPLETED", "IN_PROGRESS", "NOT_STARTED", "COMPLETED"}) {
            patchAuthenticated("/api/tasks/{id}/status", taskId,
                    """
                            {"status":"%s"}
                            """.formatted(next), session)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value(next));
        }

        Map<String, Object> updated = taskRow(taskId);
        assertThat(updated.get("status")).isEqualTo("COMPLETED");
        assertThat(updated.get("title")).isEqualTo(original.get("title"));
        assertThat(updated.get("description")).isEqualTo(original.get("description"));
        assertThat(updated.get("deadline")).isEqualTo(original.get("deadline"));
        assertThat(updated.get("account_id")).isEqualTo(original.get("account_id"));
        assertThat(updated.get("source_note_id")).isEqualTo(original.get("source_note_id"));
        assertThat(updated.get("source_status")).isEqualTo(original.get("source_status"));
        assertThat(updated.get("created_at")).isEqualTo(original.get("created_at"));
        assertThat(updated.get("updated_at")).isNotEqualTo(original.get("updated_at"));
    }

    @Test
    void invalidMissingAndBlankStatusesReturnValidationErrorWithoutMutation() throws Exception {
        Account owner = createAccount("task-status-validation@example.com");
        Long taskId = insertTask(owner.getId(), null, "INDEPENDENT", "Task", null,
                "NOT_STARTED", null, BASE_TIME);
        AuthenticatedSession session = authenticate(owner.getEmail());
        Map<String, Object> before = taskRow(taskId);

        for (String body : new String[] {
                "{\"status\":\"OVERDUE\"}",
                "{\"status\":\"   \"}",
                "{}"}) {
            patchAuthenticated("/api/tasks/{id}/status", taskId, body, session)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fieldErrors.status").exists());
        }
        assertThat(taskRow(taskId)).isEqualTo(before);
    }

    @Test
    void everySourceStateRemainsExactAndEditableWithoutLibraryOrAvailableYouTube() throws Exception {
        Account owner = createAccount("task-update-lifecycle@example.com");
        YouTubeVideo source = createSource("task-update-unavailable", YouTubeAvailabilityStatus.UNAVAILABLE);
        LibraryVideo libraryVideo = libraryVideoRepository.saveAndFlush(
                LibraryVideo.create(owner, source, BASE_TIME));
        Long noteId = insertNote(owner.getId(), source.getId(), "Context");
        Long independentId = insertTask(owner.getId(), null, "INDEPENDENT", "Independent", null,
                "NOT_STARTED", null, BASE_TIME);
        Long sourcedId = insertTask(owner.getId(), noteId, "HAS_SOURCE", "Sourced", null,
                "NOT_STARTED", null, BASE_TIME);
        Long missingId = insertTask(owner.getId(), null, "SOURCE_MISSING", "Missing", null,
                "NOT_STARTED", null, BASE_TIME);
        libraryVideoRepository.deleteById(libraryVideo.getId());
        libraryVideoRepository.flush();
        AuthenticatedSession session = authenticate(owner.getEmail());

        for (Long taskId : new Long[] {independentId, sourcedId, missingId}) {
            patchAuthenticated("/api/tasks/{id}", taskId, """
                    {"title":"Editable %d","description":null,"deadline":null}
                    """.formatted(taskId), session).andExpect(status().isOk());
            patchAuthenticated("/api/tasks/{id}/status", taskId, """
                    {"status":"COMPLETED"}
                    """, session).andExpect(status().isOk());
        }

        assertSource(independentId, "INDEPENDENT", null);
        assertSource(sourcedId, "HAS_SOURCE", noteId);
        assertSource(missingId, "SOURCE_MISSING", null);
        assertThat(count("library_videos")).isZero();
        assertThat(count("notes")).isEqualTo(1);
        assertThat(count("youtube_videos")).isEqualTo(1);
    }

    @Test
    void updatesPreserveRelatedDataAndNeverCallYouTube() throws Exception {
        Account owner = createAccount("task-update-preserve@example.com");
        YouTubeVideo source = createSource("task-update-preserve", YouTubeAvailabilityStatus.AVAILABLE);
        LibraryVideo video = libraryVideoRepository.saveAndFlush(LibraryVideo.create(owner, source, BASE_TIME));
        Long noteId = insertNote(owner.getId(), source.getId(), "Context");
        Long taskId = insertTask(owner.getId(), noteId, "HAS_SOURCE", "Task", "Description",
                "NOT_STARTED", null, BASE_TIME);
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
        AuthenticatedSession session = authenticate(owner.getEmail());
        Map<String, Object> noteBefore = row("notes", noteId);
        Map<String, Object> sourceBefore = row("youtube_videos", source.getId());
        Map<String, Object> videoBefore = row("library_videos", video.getId());
        long watchCount = count("watch_sessions");
        long tagCount = count("tags");
        long linkCount = count("library_video_tags");

        patchAuthenticated("/api/tasks/{id}", taskId, """
                {"title":"Updated","description":null,"deadline":null}
                """, session).andExpect(status().isOk());
        patchAuthenticated("/api/tasks/{id}/status", taskId, """
                {"status":"COMPLETED"}
                """, session).andExpect(status().isOk());

        assertThat(row("notes", noteId)).isEqualTo(noteBefore);
        assertThat(row("youtube_videos", source.getId())).isEqualTo(sourceBefore);
        assertThat(row("library_videos", video.getId())).isEqualTo(videoBefore);
        assertThat(count("watch_sessions")).isEqualTo(watchCount);
        assertThat(count("tags")).isEqualTo(tagCount);
        assertThat(count("library_video_tags")).isEqualTo(linkCount);
        verifyNoInteractions(youTubeMetadataClient);
    }

    private Account createAccount(String email) {
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                BASE_TIME));
    }

    private YouTubeVideo createSource(String id, YouTubeAvailabilityStatus availability) {
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                id,
                "https://www.youtube.com/watch?v=" + id,
                "Title",
                "Channel",
                null,
                100,
                BASE_TIME,
                availability,
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

    private Long insertTask(
            Long accountId,
            Long sourceNoteId,
            String sourceStatus,
            String title,
            String description,
            String status,
            LocalDate deadline,
            OffsetDateTime createdAt) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, accountId, sourceNoteId, sourceStatus, title, description,
                status, deadline, createdAt, createdAt);
    }

    private org.springframework.test.web.servlet.ResultActions patchAuthenticated(
            String path,
            Long taskId,
            String body,
            AuthenticatedSession session) throws Exception {
        return patchWithCsrf(path, taskId, body, session.accessToken(), session.csrf());
    }

    private org.springframework.test.web.servlet.ResultActions patchWithCsrf(
            String path,
            Long taskId,
            String body,
            Cookie accessToken,
            CsrfExchange csrf) throws Exception {
        var request = patch(path, taskId)
                .cookie(csrf.cookie())
                .header(csrf.headerName(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
        if (accessToken != null) {
            request.cookie(accessToken);
        }
        return mockMvc.perform(request);
    }

    private void assertTaskFields(
            Long taskId,
            String title,
            String description,
            String status,
            LocalDate deadline) {
        Map<String, Object> task = taskRow(taskId);
        assertThat(task.get("title")).isEqualTo(title);
        assertThat(task.get("description")).isEqualTo(description);
        assertThat(task.get("status")).isEqualTo(status);
        if (deadline == null) {
            assertThat(task.get("deadline")).isNull();
        } else {
            assertThat(((java.sql.Date) task.get("deadline")).toLocalDate()).isEqualTo(deadline);
        }
    }

    private void assertTimestamps(Long taskId, OffsetDateTime before, OffsetDateTime after) {
        OffsetDateTime createdAt = jdbcTemplate.queryForObject(
                "SELECT created_at FROM tasks WHERE id = ?", OffsetDateTime.class, taskId);
        OffsetDateTime updatedAt = jdbcTemplate.queryForObject(
                "SELECT updated_at FROM tasks WHERE id = ?", OffsetDateTime.class, taskId);
        assertThat(createdAt).isEqualTo(BASE_TIME);
        assertThat(updatedAt).isBetween(before, after);
        assertThat(updatedAt).isNotEqualTo(createdAt);
    }

    private void assertSource(Long taskId, String sourceStatus, Long sourceNoteId) {
        Map<String, Object> task = taskRow(taskId);
        assertThat(task.get("source_status")).isEqualTo(sourceStatus);
        if (sourceNoteId == null) {
            assertThat(task.get("source_note_id")).isNull();
        } else {
            assertThat(number(task, "source_note_id")).isEqualTo(sourceNoteId);
        }
    }

    private Map<String, Object> taskRow(Long taskId) {
        return row("tasks", taskId);
    }

    private Map<String, Object> row(String table, Long id) {
        return jdbcTemplate.queryForMap("SELECT * FROM " + table + " WHERE id = ?", id);
    }

    private long number(Map<String, Object> row, String field) {
        return ((Number) row.get(field)).longValue();
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
