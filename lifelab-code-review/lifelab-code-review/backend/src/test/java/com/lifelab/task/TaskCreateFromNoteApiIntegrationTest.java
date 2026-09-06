package com.lifelab.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
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
class TaskCreateFromNoteApiIntegrationTest {

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
    void createFromNoteRequiresAuthenticationAndValidCsrf() throws Exception {
        Account owner = createAccount("note-task-security@example.com");
        Long noteId = insertNote(owner.getId(), createSource("security", true).getId(), "Context");
        String body = """
                {"title":"Task","description":null,"deadline":null}
                """;
        CsrfExchange guestCsrf = fetchCsrf();

        mockMvc.perform(post("/api/notes/{noteId}/tasks", noteId)
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Cookie accessToken = login(owner.getEmail());
        mockMvc.perform(post("/api/notes/{noteId}/tasks", noteId)
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(count("tasks")).isZero();
    }

    @Test
    void ownerCreatesTaskFromExactNoteAndClientCannotOverrideServerFields() throws Exception {
        Account owner = createAccount("note-task-owner@example.com");
        YouTubeVideo source = createSource("exact-source", true);
        Long requestedNoteId = insertNote(owner.getId(), source.getId(), "Requested note");
        Long otherOwnedNoteId = insertNote(owner.getId(), source.getId(), "Other note");
        Account otherAccount = createAccount("note-task-other@example.com");
        Long crossAccountNoteId = insertNote(otherAccount.getId(), source.getId(), "Cross account note");
        AuthenticatedSession session = authenticate(owner.getEmail());
        OffsetDateTime before = OffsetDateTime.now().minusSeconds(1);

        mockMvc.perform(post("/api/notes/{noteId}/tasks", requestedNoteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title":"Review this concept",
                                  "description":"Apply it in project",
                                  "deadline":"2020-01-01",
                                  "accountId":%d,
                                  "sourceNoteId":%d,
                                  "sourceStatus":"INDEPENDENT",
                                  "status":"COMPLETED"
                                }
                                """.formatted(otherAccount.getId(), otherOwnedNoteId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Review this concept"))
                .andExpect(jsonPath("$.description").value("Apply it in project"))
                .andExpect(jsonPath("$.deadline").value("2020-01-01"))
                .andExpect(jsonPath("$.sourceNoteId").value(requestedNoteId))
                .andExpect(jsonPath("$.sourceStatus").value("HAS_SOURCE"))
                .andExpect(jsonPath("$.status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.accountId").doesNotExist());

        OffsetDateTime after = OffsetDateTime.now().plusSeconds(1);
        Map<String, Object> task = jdbcTemplate.queryForMap("SELECT * FROM tasks");
        assertThat(((Number) task.get("account_id")).longValue()).isEqualTo(owner.getId());
        assertThat(((Number) task.get("source_note_id")).longValue()).isEqualTo(requestedNoteId);
        assertThat(task.get("source_status")).isEqualTo("HAS_SOURCE");
        assertThat(task.get("status")).isEqualTo("NOT_STARTED");
        assertThat(((java.sql.Date) task.get("deadline")).toLocalDate())
                .isEqualTo(LocalDate.of(2020, 1, 1));
        OffsetDateTime createdAt = jdbcTemplate.queryForObject(
                "SELECT created_at FROM tasks", OffsetDateTime.class);
        OffsetDateTime updatedAt = jdbcTemplate.queryForObject(
                "SELECT updated_at FROM tasks", OffsetDateTime.class);
        assertThat(createdAt).isBetween(before, after);
        assertThat(updatedAt).isEqualTo(createdAt);
        assertThat(((Number) task.get("source_note_id")).longValue()).isNotEqualTo(otherOwnedNoteId);
        assertThat(((Number) task.get("source_note_id")).longValue()).isNotEqualTo(crossAccountNoteId);
    }

    @Test
    void optionalFieldsAreNullAndSameTitleValidationIsEnforced() throws Exception {
        Account owner = createAccount("note-task-validation@example.com");
        Long noteId = insertNote(owner.getId(), createSource("validation", true).getId(), "Context");
        AuthenticatedSession session = authenticate(owner.getEmail());

        mockMvc.perform(post("/api/notes/{noteId}/tasks", noteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Optional task","description":null,"deadline":null}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.deadline").doesNotExist());

        for (String invalidTitle : new String[] {"", "   \t", "\u00A0\u2003", "a".repeat(256)}) {
            mockMvc.perform(post("/api/notes/{noteId}/tasks", noteId)
                            .cookie(session.accessToken(), session.csrf().cookie())
                            .header(session.csrf().headerName(), session.csrf().token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("title", invalidTitle))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fieldErrors.title").exists());
        }
        assertThat(count("tasks")).isEqualTo(1);
    }

    @Test
    void unknownAndCrossAccountNotesReturnSameSafeNotFoundWithoutCreatingTask() throws Exception {
        Account owner = createAccount("note-task-private-owner@example.com");
        Account other = createAccount("note-task-private-other@example.com");
        Long otherNoteId = insertNote(other.getId(), createSource("private", true).getId(), "Private");
        AuthenticatedSession session = authenticate(owner.getEmail());
        String body = """
                {"title":"Task","description":null,"deadline":null}
                """;

        for (Long noteId : new Long[] {999999L, otherNoteId}) {
            mockMvc.perform(post("/api/notes/{noteId}/tasks", noteId)
                            .cookie(session.accessToken(), session.csrf().cookie())
                            .header(session.csrf().headerName(), session.csrf().token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOTE_NOT_FOUND"));
        }
        assertThat(count("tasks")).isZero();
    }

    @Test
    void creationWorksWithoutLibraryVideoAndForUnavailableSource() throws Exception {
        Account owner = createAccount("note-task-lifecycle@example.com");
        YouTubeVideo availableSource = createSource("deleted-library", true);
        LibraryVideo libraryVideo = libraryVideoRepository.saveAndFlush(
                LibraryVideo.create(owner, availableSource, BASE_TIME));
        Long retainedNoteId = insertNote(owner.getId(), availableSource.getId(), "Retained context");
        libraryVideoRepository.deleteById(libraryVideo.getId());
        libraryVideoRepository.flush();

        YouTubeVideo unavailableSource = createSource("unavailable", false);
        Long unavailableNoteId = insertNote(owner.getId(), unavailableSource.getId(), "Unavailable context");
        AuthenticatedSession session = authenticate(owner.getEmail());

        for (Long noteId : new Long[] {retainedNoteId, unavailableNoteId}) {
            mockMvc.perform(post("/api/notes/{noteId}/tasks", noteId)
                            .cookie(session.accessToken(), session.csrf().cookie())
                            .header(session.csrf().headerName(), session.csrf().token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"title":"Retained task","description":null,"deadline":null}
                                    """))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.sourceNoteId").value(noteId));
        }

        assertThat(count("tasks")).isEqualTo(2);
        assertThat(count("notes")).isEqualTo(2);
        assertThat(count("youtube_videos")).isEqualTo(2);
        assertThat(count("library_videos")).isZero();
    }

    @Test
    void creatingTaskPreservesSourceAndUnrelatedDataAndIndependentEndpointStillWorks() throws Exception {
        Account owner = createAccount("note-task-preserve@example.com");
        YouTubeVideo source = createSource("preserve", true);
        LibraryVideo video = libraryVideoRepository.saveAndFlush(LibraryVideo.create(owner, source, BASE_TIME));
        Long noteId = insertNote(owner.getId(), source.getId(), "Original context");
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
        Map<String, Long> beforeCounts = tableCounts();
        Map<String, Object> noteBefore = jdbcTemplate.queryForMap("SELECT * FROM notes WHERE id = ?", noteId);
        Map<String, Object> videoBefore = jdbcTemplate.queryForMap(
                "SELECT * FROM library_videos WHERE id = ?", video.getId());
        Map<String, Object> sourceBefore = jdbcTemplate.queryForMap(
                "SELECT * FROM youtube_videos WHERE id = ?", source.getId());

        mockMvc.perform(post("/api/notes/{noteId}/tasks", noteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Sourced task","description":null,"deadline":null}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/tasks")
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Independent task","description":null,"deadline":null}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceStatus").value("INDEPENDENT"));

        Map<String, Long> afterCounts = tableCounts();
        assertThat(afterCounts.get("tasks")).isEqualTo(beforeCounts.get("tasks") + 2);
        beforeCounts.remove("tasks");
        afterCounts.remove("tasks");
        assertThat(afterCounts).isEqualTo(beforeCounts);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM notes WHERE id = ?", noteId))
                .isEqualTo(noteBefore);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM library_videos WHERE id = ?", video.getId()))
                .isEqualTo(videoBefore);
        assertThat(jdbcTemplate.queryForMap("SELECT * FROM youtube_videos WHERE id = ?", source.getId()))
                .isEqualTo(sourceBefore);
        verifyNoInteractions(youTubeMetadataClient);
    }

    private Account createAccount(String email) {
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                BASE_TIME));
    }

    private YouTubeVideo createSource(String youtubeVideoId, boolean available) {
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                "Title",
                "Channel",
                "https://image.example/" + youtubeVideoId + ".jpg",
                100,
                BASE_TIME,
                available ? YouTubeAvailabilityStatus.AVAILABLE : YouTubeAvailabilityStatus.UNAVAILABLE,
                BASE_TIME));
    }

    private Long insertNote(Long accountId, Long youtubeSourceId, String content) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, ?, 5, ?, ?)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId, content, BASE_TIME, BASE_TIME);
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
