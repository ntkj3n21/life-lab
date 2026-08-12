package com.lifelab.note;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
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
class NoteDeleteApiIntegrationTest {

    private static final String PASSWORD = "Password123";
    private static final OffsetDateTime BASE_TIME = OffsetDateTime.parse("2026-03-15T12:00:00Z");

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
    void impactAndDeleteRequireAuthenticationAndDeleteRequiresCsrf() throws Exception {
        Account owner = createAccount("note-delete-security@example.com");
        YouTubeVideo source = createSource("note-delete-security-source");
        Long noteId = insertNote(owner.getId(), source.getId(), "Context");

        mockMvc.perform(get("/api/notes/{id}/delete-impact", noteId))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        CsrfExchange guestCsrf = fetchCsrf();
        mockMvc.perform(delete("/api/notes/{id}", noteId)
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Cookie accessToken = login(owner.getEmail());
        mockMvc.perform(delete("/api/notes/{id}", noteId).cookie(accessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(count("notes")).isEqualTo(1);
    }

    @Test
    void unusedNoteImpactReportsZeroAndDoesNotMutateData() throws Exception {
        Account owner = createAccount("note-impact-unused@example.com");
        YouTubeVideo source = createSource("note-impact-unused-source");
        Long noteId = insertNote(owner.getId(), source.getId(), "Unused");
        Map<String, Long> countsBefore = tableCounts();
        OffsetDateTime noteUpdatedAt = timestamp("SELECT updated_at FROM notes WHERE id = ?", noteId);
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/notes/{id}/delete-impact", noteId).cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noteId").value(noteId))
                .andExpect(jsonPath("$.taskCountToMarkSourceMissing").value(0))
                .andExpect(jsonPath("$.tasksPreserved").value(true))
                .andExpect(jsonPath("$.youtubeSourcePreserved").value(true));

        assertThat(tableCounts()).isEqualTo(countsBefore);
        assertThat(timestamp("SELECT updated_at FROM notes WHERE id = ?", noteId)).isEqualTo(noteUpdatedAt);
    }

    @Test
    void linkedNoteImpactCountsExactlyAndPerformsNoMutation() throws Exception {
        Account owner = createAccount("note-impact-linked@example.com");
        YouTubeVideo source = createSource("note-impact-linked-source");
        Long noteId = insertNote(owner.getId(), source.getId(), "Linked");
        Long firstTask = insertLinkedTask(
                owner.getId(), noteId, "First", "First description", "IN_PROGRESS", LocalDate.of(2026, 4, 1));
        Long secondTask = insertLinkedTask(
                owner.getId(), noteId, "Second", null, "COMPLETED", LocalDate.of(2026, 5, 1));
        Map<String, Object> firstBefore = taskRow(firstTask);
        Map<String, Object> secondBefore = taskRow(secondTask);
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/notes/{id}/delete-impact", noteId).cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.taskCountToMarkSourceMissing").value(2))
                .andExpect(jsonPath("$.tasksPreserved").value(true))
                .andExpect(jsonPath("$.youtubeSourcePreserved").value(true));

        assertThat(taskRow(firstTask)).isEqualTo(firstBefore);
        assertThat(taskRow(secondTask)).isEqualTo(secondBefore);
        assertThat(count("notes")).isEqualTo(1);
    }

    @Test
    void unknownAndCrossAccountImpactAndDeleteUseSameSafeNotFoundWithoutMutation() throws Exception {
        Account owner = createAccount("note-delete-owner@example.com");
        Account other = createAccount("note-delete-other@example.com");
        YouTubeVideo source = createSource("note-delete-private-source");
        Long privateNote = insertNote(other.getId(), source.getId(), "Private");
        Long privateTask = insertLinkedTask(
                other.getId(), privateNote, "Private task", "Private", "NOT_STARTED", null);
        AuthenticatedSession session = authenticate(owner.getEmail());
        Map<String, Long> countsBefore = tableCounts();
        Map<String, Object> privateTaskBefore = taskRow(privateTask);

        for (Long noteId : new Long[] {999999L, privateNote}) {
            mockMvc.perform(get("/api/notes/{id}/delete-impact", noteId)
                            .cookie(session.accessToken()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOTE_NOT_FOUND"));
            mockMvc.perform(delete("/api/notes/{id}", noteId)
                            .cookie(session.accessToken(), session.csrf().cookie())
                            .header(session.csrf().headerName(), session.csrf().token()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOTE_NOT_FOUND"));
        }

        assertThat(tableCounts()).isEqualTo(countsBefore);
        assertThat(taskRow(privateTask)).isEqualTo(privateTaskBefore);
    }

    @Test
    void deletingUnusedNoteRemovesOnlyNoteAndPreservesSourceAndLibraryVideo() throws Exception {
        Account owner = createAccount("note-delete-unused@example.com");
        YouTubeVideo source = createSource("note-delete-unused-source");
        LibraryVideo video = createLibraryVideo(owner, source);
        Long noteId = insertNote(owner.getId(), source.getId(), "Unused");
        AuthenticatedSession session = authenticate(owner.getEmail());

        mockMvc.perform(delete("/api/notes/{id}", noteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token()))
                .andExpect(status().isNoContent());

        assertThat(count("notes")).isZero();
        assertThat(exists("youtube_videos", source.getId())).isTrue();
        assertThat(exists("library_videos", video.getId())).isTrue();
        mockMvc.perform(get("/api/notes/{id}", noteId).cookie(session.accessToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTE_NOT_FOUND"));
        mockMvc.perform(get("/api/notes").cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0));
        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void deletingLinkedNoteMarksTasksSourceMissingAndPreservesAllOtherBusinessData() throws Exception {
        Account owner = createAccount("note-delete-linked@example.com");
        YouTubeVideo source = createSource("note-delete-linked-source");
        LibraryVideo video = createLibraryVideo(owner, source);
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

        Long noteId = insertNote(owner.getId(), source.getId(), "Delete me");
        Long unrelatedNote = insertNote(owner.getId(), source.getId(), "Keep me");
        Long firstTask = insertLinkedTask(
                owner.getId(), noteId, "First", "First description", "IN_PROGRESS", LocalDate.of(2026, 4, 1));
        Long secondTask = insertLinkedTask(
                owner.getId(), noteId, "Second", null, "COMPLETED", LocalDate.of(2026, 5, 2));
        Long unrelatedTask = insertLinkedTask(
                owner.getId(), unrelatedNote, "Unrelated", "Keep", "NOT_STARTED", LocalDate.of(2026, 6, 3));
        Long independentTask = insertIndependentTask(owner.getId(), "Independent");
        Map<String, Object> firstBefore = taskBusinessData(firstTask);
        Map<String, Object> secondBefore = taskBusinessData(secondTask);
        Map<String, Object> unrelatedBefore = taskRow(unrelatedTask);
        Map<String, Object> independentBefore = taskRow(independentTask);
        OffsetDateTime firstUpdatedAt = timestamp("SELECT updated_at FROM tasks WHERE id = ?", firstTask);
        OffsetDateTime secondUpdatedAt = timestamp("SELECT updated_at FROM tasks WHERE id = ?", secondTask);
        Map<String, Long> countsBefore = tableCounts();
        AuthenticatedSession session = authenticate(owner.getEmail());

        mockMvc.perform(delete("/api/notes/{id}", noteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token()))
                .andExpect(status().isNoContent());

        assertThat(count("tasks")).isEqualTo(countsBefore.get("tasks"));
        assertThat(count("notes")).isEqualTo(countsBefore.get("notes") - 1);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM tasks
                WHERE id IN (?, ?)
                  AND source_note_id IS NULL
                  AND source_status = 'SOURCE_MISSING'
                """, Long.class, firstTask, secondTask)).isEqualTo(2);
        assertThat(taskBusinessData(firstTask)).isEqualTo(firstBefore);
        assertThat(taskBusinessData(secondTask)).isEqualTo(secondBefore);
        assertThat(timestamp("SELECT updated_at FROM tasks WHERE id = ?", firstTask)).isAfter(firstUpdatedAt);
        assertThat(timestamp("SELECT updated_at FROM tasks WHERE id = ?", secondTask)).isAfter(secondUpdatedAt);
        assertThat(timestamp("SELECT updated_at FROM tasks WHERE id = ?", firstTask))
                .isEqualTo(timestamp("SELECT updated_at FROM tasks WHERE id = ?", secondTask));
        assertThat(taskRow(unrelatedTask)).isEqualTo(unrelatedBefore);
        assertThat(taskRow(independentTask)).isEqualTo(independentBefore);

        assertThat(exists("library_videos", video.getId())).isTrue();
        assertThat(exists("youtube_videos", source.getId())).isTrue();
        assertThat(exists("tags", tag.getId())).isTrue();
        assertThat(count("library_video_tags")).isEqualTo(countsBefore.get("library_video_tags"));
        assertThat(count("watch_sessions")).isEqualTo(countsBefore.get("watch_sessions"));
        assertThat(exists("notes", unrelatedNote)).isTrue();
        mockMvc.perform(get("/api/notes/{id}", noteId).cookie(session.accessToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTE_NOT_FOUND"));
        mockMvc.perform(get("/api/notes").cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(unrelatedNote));
        verifyNoInteractions(youTubeMetadataClient);
    }

    private Account createAccount(String email) {
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                BASE_TIME));
    }

    private YouTubeVideo createSource(String youtubeVideoId) {
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                "Title",
                "Channel",
                "https://image.example/" + youtubeVideoId + ".jpg",
                100,
                BASE_TIME,
                YouTubeAvailabilityStatus.AVAILABLE,
                BASE_TIME));
    }

    private LibraryVideo createLibraryVideo(Account account, YouTubeVideo source) {
        return libraryVideoRepository.saveAndFlush(LibraryVideo.create(account, source, BASE_TIME));
    }

    private Long insertNote(Long accountId, Long youtubeSourceId, String content) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, ?, 10, ?, ?)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId, content, BASE_TIME, BASE_TIME);
    }

    private Long insertLinkedTask(
            Long accountId,
            Long noteId,
            String title,
            String description,
            String status,
            LocalDate deadline) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, ?, 'HAS_SOURCE', ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, accountId, noteId, title, description, status, deadline, BASE_TIME, BASE_TIME);
    }

    private Long insertIndependentTask(Long accountId, String title) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, NULL, 'INDEPENDENT', ?, 'Independent description',
                    'NOT_STARTED', NULL, ?, ?)
                RETURNING id
                """, Long.class, accountId, title, BASE_TIME, BASE_TIME);
    }

    private Map<String, Object> taskBusinessData(Long taskId) {
        return jdbcTemplate.queryForMap("""
                SELECT account_id, title, description, status, deadline, created_at
                FROM tasks WHERE id = ?
                """, taskId);
    }

    private Map<String, Object> taskRow(Long taskId) {
        return jdbcTemplate.queryForMap("SELECT * FROM tasks WHERE id = ?", taskId);
    }

    private Map<String, Long> tableCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : new String[] {
                "accounts", "youtube_videos", "library_videos", "tags",
                "library_video_tags", "watch_sessions", "notes", "tasks"}) {
            counts.put(table, count(table));
        }
        return counts;
    }

    private long count(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
    }

    private boolean exists(String table, Long id) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM " + table + " WHERE id = ?)", Boolean.class, id));
    }

    private OffsetDateTime timestamp(String sql, Long id) {
        return jdbcTemplate.queryForObject(sql, OffsetDateTime.class, id);
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
