package com.lifelab.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
class TaskCreateApiIntegrationTest {

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
    void createRequiresAuthenticationAndValidCsrf() throws Exception {
        Account owner = createAccount("task-security@example.com");
        String body = """
                {"title":"Task","description":null,"deadline":null}
                """;
        CsrfExchange guestCsrf = fetchCsrf();

        mockMvc.perform(post("/api/tasks")
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Cookie accessToken = login(owner.getEmail());
        mockMvc.perform(post("/api/tasks")
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(count("tasks")).isZero();
    }

    @Test
    void ownerCreatesIndependentTaskWithServerControlledOwnershipAndStatuses() throws Exception {
        Account owner = createAccount("task-owner@example.com");
        Account other = createAccount("task-other@example.com");
        YouTubeVideo source = createSource("task-client-source");
        Long noteId = insertNote(other.getId(), source.getId());
        AuthenticatedSession session = authenticate(owner.getEmail());
        OffsetDateTime before = OffsetDateTime.now(ZoneOffset.UTC).minusSeconds(1);

        MvcResult result = mockMvc.perform(post("/api/tasks")
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Review chapter","description":"Optional description",
                                 "deadline":"2026-08-20","accountId":%d,"sourceNoteId":%d,
                                 "sourceStatus":"HAS_SOURCE","status":"COMPLETED"}
                                """.formatted(other.getId(), noteId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Review chapter"))
                .andExpect(jsonPath("$.description").value("Optional description"))
                .andExpect(jsonPath("$.deadline").value("2026-08-20"))
                .andExpect(jsonPath("$.status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.sourceStatus").value("INDEPENDENT"))
                .andExpect(jsonPath("$.sourceNoteId").doesNotExist())
                .andExpect(jsonPath("$.accountId").doesNotExist())
                .andReturn();
        OffsetDateTime after = OffsetDateTime.now(ZoneOffset.UTC).plusSeconds(1);

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        Long taskId = response.get("id").longValue();
        Map<String, Object> persisted = jdbcTemplate.queryForMap("""
                SELECT account_id, source_note_id, source_status, title, description, status, deadline
                FROM tasks WHERE id = ?
                """, taskId);
        assertThat(((Number) persisted.get("account_id")).longValue()).isEqualTo(owner.getId());
        assertThat(persisted.get("source_note_id")).isNull();
        assertThat(persisted.get("source_status")).isEqualTo("INDEPENDENT");
        assertThat(persisted.get("status")).isEqualTo("NOT_STARTED");
        assertThat(persisted.get("title")).isEqualTo("Review chapter");
        assertThat(timestamp("SELECT created_at FROM tasks WHERE id = ?", taskId))
                .isBetween(before, after);
        assertThat(timestamp("SELECT updated_at FROM tasks WHERE id = ?", taskId))
                .isEqualTo(timestamp("SELECT created_at FROM tasks WHERE id = ?", taskId));
    }

    @Test
    void optionalDescriptionAndDeadlineMayRemainNull() throws Exception {
        Account owner = createAccount("task-optional@example.com");
        AuthenticatedSession session = authenticate(owner.getEmail());

        mockMvc.perform(post("/api/tasks")
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Minimal task","description":null,"deadline":null}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.deadline").doesNotExist());

        Map<String, Object> row = jdbcTemplate.queryForMap("SELECT description, deadline FROM tasks");
        assertThat(row.get("description")).isNull();
        assertThat(row.get("deadline")).isNull();
    }

    @Test
    void pastTodayAndFutureDeadlinesAreAllAccepted() throws Exception {
        Account owner = createAccount("task-deadline@example.com");
        AuthenticatedSession session = authenticate(owner.getEmail());
        LocalDate today = LocalDate.now();
        LocalDate[] deadlines = {LocalDate.of(2000, 1, 1), today, LocalDate.of(2100, 1, 1)};

        for (int index = 0; index < deadlines.length; index++) {
            mockMvc.perform(post("/api/tasks")
                            .cookie(session.accessToken(), session.csrf().cookie())
                            .header(session.csrf().headerName(), session.csrf().token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"title":"Task %d","deadline":"%s"}
                                    """.formatted(index, deadlines[index])))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.deadline").value(deadlines[index].toString()));
        }
        assertThat(count("tasks")).isEqualTo(3);
    }

    @Test
    void invalidTitlesReturnValidationErrorsAndCreateNothing() throws Exception {
        Account owner = createAccount("task-validation@example.com");
        AuthenticatedSession session = authenticate(owner.getEmail());
        String[] invalidTitles = {null, "     ", "\u00A0\u2003", "a".repeat(256)};

        for (String title : invalidTitles) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("title", title);
            body.put("description", null);
            body.put("deadline", null);
            mockMvc.perform(post("/api/tasks")
                            .cookie(session.accessToken(), session.csrf().cookie())
                            .header(session.csrf().headerName(), session.csrf().token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsBytes(body)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fieldErrors.title").exists());
        }
        assertThat(count("tasks")).isZero();
    }

    @Test
    void independentCreationMutatesOnlyTasksAndNeverCallsYoutube() throws Exception {
        Account owner = createAccount("task-mutation@example.com");
        YouTubeVideo source = createSource("task-mutation-source");
        LibraryVideo video = libraryVideoRepository.saveAndFlush(LibraryVideo.create(owner, source, BASE_TIME));
        Long noteId = insertNote(owner.getId(), source.getId());
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
        Map<String, Long> countsBefore = tableCounts();
        OffsetDateTime noteUpdatedAt = timestamp("SELECT updated_at FROM notes WHERE id = ?", noteId);
        OffsetDateTime videoUpdatedAt = timestamp(
                "SELECT updated_at FROM library_videos WHERE id = ?", video.getId());
        OffsetDateTime sourceUpdatedAt = timestamp(
                "SELECT updated_at FROM youtube_videos WHERE id = ?", source.getId());

        mockMvc.perform(post("/api/tasks")
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Independent","description":"Only a task","deadline":null}
                                """))
                .andExpect(status().isCreated());

        Map<String, Long> countsAfter = tableCounts();
        assertThat(countsAfter.get("tasks")).isEqualTo(countsBefore.get("tasks") + 1);
        countsBefore.remove("tasks");
        countsAfter.remove("tasks");
        assertThat(countsAfter).isEqualTo(countsBefore);
        assertThat(timestamp("SELECT updated_at FROM notes WHERE id = ?", noteId)).isEqualTo(noteUpdatedAt);
        assertThat(timestamp("SELECT updated_at FROM library_videos WHERE id = ?", video.getId()))
                .isEqualTo(videoUpdatedAt);
        assertThat(timestamp("SELECT updated_at FROM youtube_videos WHERE id = ?", source.getId()))
                .isEqualTo(sourceUpdatedAt);
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

    private Long insertNote(Long accountId, Long youtubeSourceId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, 'Context', 5, ?, ?)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId, BASE_TIME, BASE_TIME);
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
