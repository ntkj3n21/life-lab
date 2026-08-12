package com.lifelab.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;

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
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;

import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "app.security.jwt.secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "app.security.cookie.secure=false"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class DailyPlanApiIntegrationTest {

    private static final String PASSWORD = "Password123";
    private static final OffsetDateTime BASE_TIME =
            OffsetDateTime.parse("2026-08-10T10:00:00Z");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

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
    void planRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/plan"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void emptyAccountReturnsAllFiveEmptyGroups() throws Exception {
        Account owner = createAccount("plan-empty@example.com");
        Cookie accessToken = login(owner.getEmail());

        LocalDate expectedDate =
                LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));

        mockMvc.perform(get("/api/plan")
                        .header("X-Time-Zone", "Asia/Ho_Chi_Minh")
                        .cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentDate")
                        .value(expectedDate.toString()))
                .andExpect(jsonPath("$.timeZone")
                        .value("Asia/Ho_Chi_Minh"))
                .andExpect(jsonPath("$.overdue").isEmpty())
                .andExpect(jsonPath("$.today").isEmpty())
                .andExpect(jsonPath("$.upcoming").isEmpty())
                .andExpect(jsonPath("$.noDeadline").isEmpty())
                .andExpect(jsonPath("$.completed").isEmpty());
    }

    @Test
    void groupsCurrentAccountTasksExactlyOnceWithCompletedPriority()
            throws Exception {

        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(zone);

        Account owner = createAccount("plan-groups@example.com");
        Account other = createAccount("plan-other@example.com");

        Long overdue = insertTask(
                owner.getId(),
                "Overdue",
                "NOT_STARTED",
                today.minusDays(1),
                "INDEPENDENT",
                null,
                BASE_TIME.plusMinutes(1));

        Long todayTask = insertTask(
                owner.getId(),
                "Today",
                "IN_PROGRESS",
                today,
                "INDEPENDENT",
                null,
                BASE_TIME.plusMinutes(2));

        Long upcoming = insertTask(
                owner.getId(),
                "Upcoming",
                "NOT_STARTED",
                today.plusDays(1),
                "INDEPENDENT",
                null,
                BASE_TIME.plusMinutes(3));

        Long noDeadline = insertTask(
                owner.getId(),
                "No deadline",
                "IN_PROGRESS",
                null,
                "SOURCE_MISSING",
                null,
                BASE_TIME.plusMinutes(4));

        Long completedPast = insertTask(
                owner.getId(),
                "Completed past",
                "COMPLETED",
                today.minusDays(10),
                "INDEPENDENT",
                null,
                BASE_TIME.plusMinutes(5));

        Long completedNoDeadline = insertTask(
                owner.getId(),
                "Completed without deadline",
                "COMPLETED",
                null,
                "INDEPENDENT",
                null,
                BASE_TIME.plusMinutes(6));

        insertTask(
                other.getId(),
                "Foreign",
                "NOT_STARTED",
                today,
                "INDEPENDENT",
                null,
                BASE_TIME.plusMinutes(7));

        Cookie accessToken = login(owner.getEmail());

        JsonNode response = getPlan(accessToken, "Asia/Ho_Chi_Minh");

        assertThat(ids(response.get("overdue")))
                .containsExactly(overdue);

        assertThat(ids(response.get("today")))
                .containsExactly(todayTask);

        assertThat(ids(response.get("upcoming")))
                .containsExactly(upcoming);

        assertThat(ids(response.get("noDeadline")))
                .containsExactly(noDeadline);

        assertThat(ids(response.get("completed")))
                .containsExactly(completedNoDeadline, completedPast);

        Set<Long> all = new HashSet<>();
        all.addAll(ids(response.get("overdue")));
        all.addAll(ids(response.get("today")));
        all.addAll(ids(response.get("upcoming")));
        all.addAll(ids(response.get("noDeadline")));
        all.addAll(ids(response.get("completed")));

        assertThat(all)
                .containsExactlyInAnyOrder(
                        overdue,
                        todayTask,
                        upcoming,
                        noDeadline,
                        completedPast,
                        completedNoDeadline);

        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void orderingInsideGroupsIsCreatedAtDescThenIdDesc()
            throws Exception {

        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(zone);

        Account owner = createAccount("plan-order@example.com");

        Long older = insertTask(
                owner.getId(),
                "Older",
                "NOT_STARTED",
                today,
                "INDEPENDENT",
                null,
                BASE_TIME);

        Long sameTimeFirst = insertTask(
                owner.getId(),
                "Same first",
                "NOT_STARTED",
                today,
                "INDEPENDENT",
                null,
                BASE_TIME.plusHours(1));

        Long sameTimeSecond = insertTask(
                owner.getId(),
                "Same second",
                "NOT_STARTED",
                today,
                "INDEPENDENT",
                null,
                BASE_TIME.plusHours(1));

        Cookie accessToken = login(owner.getEmail());

        JsonNode response = getPlan(accessToken, "Asia/Ho_Chi_Minh");

        assertThat(ids(response.get("today")))
                .containsExactly(
                        sameTimeSecond,
                        sameTimeFirst,
                        older);
    }

    @Test
    void invalidAndBlankTimezoneReturnValidationError()
            throws Exception {

        Account owner = createAccount("plan-timezone@example.com");
        Cookie accessToken = login(owner.getEmail());

        for (String zone : new String[] {
                "Mars/Olympus",
                "",
                "   "
        }) {
            mockMvc.perform(get("/api/plan")
                            .header("X-Time-Zone", zone)
                            .cookie(accessToken))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code")
                            .value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fieldErrors.xTimeZone")
                            .exists());
        }
    }

    @Test
    void existingTaskMutationsAreReflectedWithoutStoredPlan()
            throws Exception {

        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(zone);

        Account owner = createAccount("plan-refresh@example.com");

        Long taskId = insertTask(
                owner.getId(),
                "Refresh task",
                "NOT_STARTED",
                today,
                "INDEPENDENT",
                null,
                BASE_TIME);

        AuthenticatedSession session =
                authenticate(owner.getEmail());

        JsonNode initial =
                getPlan(session.accessToken(), "Asia/Ho_Chi_Minh");

        assertThat(ids(initial.get("today")))
                .containsExactly(taskId);

        patchStatus(
                taskId,
                "COMPLETED",
                session);

        JsonNode completed =
                getPlan(session.accessToken(), "Asia/Ho_Chi_Minh");

        assertThat(ids(completed.get("today"))).isEmpty();
        assertThat(ids(completed.get("completed")))
                .containsExactly(taskId);

        patchDetails(
                taskId,
                "Refresh task",
                null,
                null,
                session);

        JsonNode stillCompleted =
                getPlan(session.accessToken(), "Asia/Ho_Chi_Minh");

        assertThat(ids(stillCompleted.get("completed")))
                .containsExactly(taskId);

        patchStatus(
                taskId,
                "IN_PROGRESS",
                session);

        JsonNode noDeadline =
                getPlan(session.accessToken(), "Asia/Ho_Chi_Minh");

        assertThat(ids(noDeadline.get("completed"))).isEmpty();
        assertThat(ids(noDeadline.get("noDeadline")))
                .containsExactly(taskId);

        deleteTask(taskId, session);

        JsonNode deleted =
                getPlan(session.accessToken(), "Asia/Ho_Chi_Minh");

        assertThat(ids(deleted.get("overdue"))).isEmpty();
        assertThat(ids(deleted.get("today"))).isEmpty();
        assertThat(ids(deleted.get("upcoming"))).isEmpty();
        assertThat(ids(deleted.get("noDeadline"))).isEmpty();
        assertThat(ids(deleted.get("completed"))).isEmpty();
    }

    @Test
    void readingPlanDoesNotMutateTasks() throws Exception {
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(zone);

        Account owner = createAccount("plan-readonly@example.com");

        Long taskId = insertTask(
                owner.getId(),
                "Read only",
                "NOT_STARTED",
                today.minusDays(1),
                "SOURCE_MISSING",
                null,
                BASE_TIME);

        var before = jdbcTemplate.queryForMap(
                "SELECT * FROM tasks WHERE id = ?",
                taskId);

        Cookie accessToken = login(owner.getEmail());

        getPlan(accessToken, "Asia/Ho_Chi_Minh");

        var after = jdbcTemplate.queryForMap(
                "SELECT * FROM tasks WHERE id = ?",
                taskId);

        assertThat(after).isEqualTo(before);

        verifyNoInteractions(youTubeMetadataClient);
    }

    private Account createAccount(String email) {
        return accountRepository.saveAndFlush(
                Account.create(
                        email,
                        passwordEncoder.encode(PASSWORD),
                        "Test User",
                        BASE_TIME));
    }

    private Long insertTask(
            Long accountId,
            String title,
            String status,
            LocalDate deadline,
            String sourceStatus,
            Long sourceNoteId,
            OffsetDateTime createdAt) {

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
                VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)
                RETURNING id
                """,
                Long.class,
                accountId,
                sourceNoteId,
                sourceStatus,
                title,
                status,
                deadline,
                createdAt,
                createdAt);
    }

    private JsonNode getPlan(
            Cookie accessToken,
            String timeZone) throws Exception {

        MvcResult result = mockMvc.perform(
                        get("/api/plan")
                                .header("X-Time-Zone", timeZone)
                                .cookie(accessToken))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(
                result.getResponse().getContentAsByteArray());
    }

    private Set<Long> ids(JsonNode array) {
        Set<Long> result = new java.util.LinkedHashSet<>();

        array.forEach(node ->
                result.add(node.get("id").longValue()));

        return result;
    }

    private void patchStatus(
            Long taskId,
            String status,
            AuthenticatedSession session) throws Exception {

        mockMvc.perform(
                        patch("/api/tasks/{taskId}/status", taskId)
                                .cookie(
                                        session.accessToken(),
                                        session.csrf().cookie())
                                .header(
                                        session.csrf().headerName(),
                                        session.csrf().token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                        {"status":"%s"}
                                        """.formatted(status)))
                .andExpect(status().isOk());
    }

    private void patchDetails(
            Long taskId,
            String title,
            String description,
            LocalDate deadline,
            AuthenticatedSession session) throws Exception {

        String body = objectMapper.writeValueAsString(
                java.util.Map.of(
                        "title", title));

        if (description == null && deadline == null) {
            body = """
                    {
                      "title":"%s",
                      "description":null,
                      "deadline":null
                    }
                    """.formatted(title);
        }

        mockMvc.perform(
                        patch("/api/tasks/{taskId}", taskId)
                                .cookie(
                                        session.accessToken(),
                                        session.csrf().cookie())
                                .header(
                                        session.csrf().headerName(),
                                        session.csrf().token())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isOk());
    }

    private void deleteTask(
            Long taskId,
            AuthenticatedSession session) throws Exception {

        mockMvc.perform(
                        delete("/api/tasks/{taskId}", taskId)
                                .cookie(
                                        session.accessToken(),
                                        session.csrf().cookie())
                                .header(
                                        session.csrf().headerName(),
                                        session.csrf().token()))
                .andExpect(status().isNoContent());
    }

    private AuthenticatedSession authenticate(String email)
            throws Exception {

        Cookie accessToken = login(email);

        return new AuthenticatedSession(
                accessToken,
                fetchCsrf(accessToken));
    }

    private Cookie login(String email) throws Exception {
        CsrfExchange csrf = fetchCsrf();

        MvcResult result = mockMvc.perform(
                        post("/api/auth/login")
                                .cookie(csrf.cookie())
                                .header(
                                        csrf.headerName(),
                                        csrf.token())
                                .contentType(MediaType.APPLICATION_JSON)
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

    private record AuthenticatedSession(
            Cookie accessToken,
            CsrfExchange csrf) {
    }

    private record CsrfExchange(
            Cookie cookie,
            String token,
            String headerName) {
    }
}