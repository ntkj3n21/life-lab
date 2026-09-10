package com.lifelab.organization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;

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
import com.lifelab.organization.category.domain.Category;
import com.lifelab.organization.category.repository.CategoryRepository;
import com.lifelab.video.domain.Tag;
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
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
class OrganizationApiIntegrationTest {

    private static final String PASSWORD = "Password123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private TagRepository tagRepository;

    @Autowired
    private YouTubeVideoRepository youTubeVideoRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private YouTubeMetadataClient youTubeMetadataClient;

    @BeforeEach
    void cleanDatabase() {
        jdbcTemplate.execute("""
                TRUNCATE TABLE task_tags, note_tags, categories, tasks, notes, watch_sessions,
                    library_video_tags, tags, library_videos, youtube_videos, accounts
                    RESTART IDENTITY CASCADE
                """);
    }

    @AfterEach
    void removeFixtures() {
        cleanDatabase();
    }

    @Test
    void categoryCrudIsNormalizedAccountScopedAndDeletionPreservesItems() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        YouTubeVideo source = createSource("category-source");
        Long noteId = insertNote(owner.getId(), source.getId());
        Long taskId = insertIndependentTask(owner.getId());
        Session ownerSession = authenticate(owner.getEmail());
        Session otherSession = authenticate(other.getEmail());

        MvcResult created = mockMvc.perform(post("/api/categories")
                        .cookie(ownerSession.accessToken(), ownerSession.csrf().cookie())
                        .header(ownerSession.csrf().headerName(), ownerSession.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Machine    Learning \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Machine Learning"))
                .andReturn();
        Long categoryId = objectMapper.readTree(created.getResponse().getContentAsByteArray())
                .get("id").longValue();

        mockMvc.perform(post("/api/categories")
                        .cookie(ownerSession.accessToken(), ownerSession.csrf().cookie())
                        .header(ownerSession.csrf().headerName(), ownerSession.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"machine learning\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CATEGORY_ALREADY_EXISTS"));

        mockMvc.perform(post("/api/categories")
                        .cookie(otherSession.accessToken(), otherSession.csrf().cookie())
                        .header(otherSession.csrf().headerName(), otherSession.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"machine learning\"}"))
                .andExpect(status().isCreated());

        jdbcTemplate.update("UPDATE notes SET category_id = ? WHERE id = ?", categoryId, noteId);
        jdbcTemplate.update("UPDATE tasks SET category_id = ? WHERE id = ?", categoryId, taskId);

        mockMvc.perform(get("/api/categories/{id}/delete-impact", categoryId)
                        .cookie(ownerSession.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noteCountToUncategorize").value(1))
                .andExpect(jsonPath("$.taskCountToUncategorize").value(1))
                .andExpect(jsonPath("$.notesPreserved").value(true))
                .andExpect(jsonPath("$.tasksPreserved").value(true));

        mockMvc.perform(delete("/api/categories/{id}", categoryId)
                        .cookie(ownerSession.accessToken(), ownerSession.csrf().cookie())
                        .header(ownerSession.csrf().headerName(), ownerSession.csrf().token()))
                .andExpect(status().isNoContent());

        assertThat(categoryRepository.findById(categoryId)).isEmpty();
        assertThat(countById("notes", noteId)).isOne();
        assertThat(countById("tasks", taskId)).isOne();
        assertThat(value("SELECT category_id FROM notes WHERE id = ?", noteId)).isNull();
        assertThat(value("SELECT category_id FROM tasks WHERE id = ?", taskId)).isNull();
    }

    @Test
    void noteAndTaskOrganizationReplaceCategoryAndTagsWithoutCrossAccountLeakage() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        YouTubeVideo source = createSource("organization-source");
        Long noteId = insertNote(owner.getId(), source.getId());
        Long taskId = insertTaskFromNote(owner.getId(), noteId);
        Category category = createCategory(owner, "Java", "java");
        Category otherCategory = createCategory(other, "Private", "private");
        Tag alpha = createTag(owner, "Alpha", "alpha");
        Tag beta = createTag(owner, "Beta", "beta");
        Tag otherTag = createTag(other, "Private", "private");
        Session session = authenticate(owner.getEmail());

        String body = """
                {"categoryId":%d,"tagIds":[%d,%d,%d]}
                """.formatted(category.getId(), beta.getId(), alpha.getId(), beta.getId());

        mockMvc.perform(patch("/api/notes/{id}/organization", noteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.id").value(category.getId()))
                .andExpect(jsonPath("$.category.name").value("Java"))
                .andExpect(jsonPath("$.tags.length()").value(2))
                .andExpect(jsonPath("$.tags[0].id").value(alpha.getId()))
                .andExpect(jsonPath("$.tags[1].id").value(beta.getId()));

        mockMvc.perform(get("/api/notes/{id}/organization", noteId)
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.id").value(category.getId()))
                .andExpect(jsonPath("$.tags.length()").value(2));

        mockMvc.perform(patch("/api/tasks/{id}/organization", taskId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.id").value(category.getId()))
                .andExpect(jsonPath("$.tags.length()").value(2));

        String crossAccountCategory = """
                {"categoryId":%d,"tagIds":[]}
                """.formatted(otherCategory.getId());
        mockMvc.perform(patch("/api/notes/{id}/organization", noteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(crossAccountCategory))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CATEGORY_NOT_FOUND"));

        String crossAccountTag = """
                {"categoryId":%d,"tagIds":[%d]}
                """.formatted(category.getId(), otherTag.getId());
        mockMvc.perform(patch("/api/tasks/{id}/organization", taskId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(crossAccountTag))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));

        mockMvc.perform(get("/api/notes/{id}/organization", noteId)
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.id").value(category.getId()))
                .andExpect(jsonPath("$.tags.length()").value(2));

        mockMvc.perform(get("/api/tasks/{id}/organization", taskId)
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.id").value(category.getId()))
                .andExpect(jsonPath("$.tags.length()").value(2));

        mockMvc.perform(patch("/api/notes/{id}/organization", noteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":null,\"tagIds\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").doesNotExist())
                .andExpect(jsonPath("$.tags.length()").value(0));

        assertThat(value("SELECT category_id FROM notes WHERE id = ?", noteId)).isNull();
        assertThat(count("note_tags", "note_id", noteId)).isZero();
    }

    @Test
    void deletingGlobalTagDetachesItFromNotesAndTasksWhilePreservingItems() throws Exception {
        Account owner = createAccount("owner@example.com");
        YouTubeVideo source = createSource("tag-source");
        Long noteId = insertNote(owner.getId(), source.getId());
        Long taskId = insertTaskFromNote(owner.getId(), noteId);
        Tag tag = createTag(owner, "Review", "review");
        jdbcTemplate.update("INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)", noteId, tag.getId());
        jdbcTemplate.update("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)", taskId, tag.getId());
        Session session = authenticate(owner.getEmail());

        mockMvc.perform(get("/api/tags/{id}/delete-impact", tag.getId())
                        .cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.noteCountToDetach").value(1))
                .andExpect(jsonPath("$.taskCountToDetach").value(1))
                .andExpect(jsonPath("$.notesPreserved").value(true))
                .andExpect(jsonPath("$.tasksPreserved").value(true));

        mockMvc.perform(delete("/api/tags/{id}", tag.getId())
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token()))
                .andExpect(status().isNoContent());

        assertThat(tagRepository.findById(tag.getId())).isEmpty();
        assertThat(countById("notes", noteId)).isOne();
        assertThat(countById("tasks", taskId)).isOne();
        assertThat(count("note_tags", "note_id", noteId)).isZero();
        assertThat(count("task_tags", "task_id", taskId)).isZero();
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
    }

    private Category createCategory(Account account, String name, String normalizedName) {
        return categoryRepository.saveAndFlush(Category.create(
                account,
                name,
                normalizedName,
                OffsetDateTime.now()));
    }

    private Tag createTag(Account account, String name, String normalizedName) {
        return tagRepository.saveAndFlush(Tag.create(
                account,
                name,
                normalizedName,
                OffsetDateTime.now()));
    }

    private YouTubeVideo createSource(String youtubeVideoId) {
        OffsetDateTime now = OffsetDateTime.now();
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                "Source title",
                "Source channel",
                "https://image.example/thumbnail.jpg",
                321,
                OffsetDateTime.parse("2024-04-15T09:30:00Z"),
                YouTubeAvailabilityStatus.AVAILABLE,
                now));
    }

    private Long insertNote(Long accountId, Long youtubeSourceId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, 'Context', 120, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId);
    }

    private Long insertIndependentTask(Long accountId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, NULL, 'INDEPENDENT', 'Independent task', NULL,
                    'NOT_STARTED', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId);
    }

    private Long insertTaskFromNote(Long accountId, Long noteId) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, ?, 'HAS_SOURCE', 'Task from note', NULL,
                    'NOT_STARTED', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
                """, Long.class, accountId, noteId);
    }

    private long countById(String table, Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE id = ?",
                Long.class,
                id);
    }

    private long count(String table, String column, Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?",
                Long.class,
                id);
    }

    private Object value(String sql, Long id) {
        return jdbcTemplate.queryForObject(sql, Object.class, id);
    }

    private Session authenticate(String email) throws Exception {
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
        return new CsrfExchange(
                csrfCookie,
                csrfCookie.getValue(),
                body.get("headerName").stringValue());
    }

    private record Session(Cookie accessToken, CsrfExchange csrf) {
    }

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }
}
