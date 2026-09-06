package com.lifelab.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;

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
class TagApiIntegrationTest {

    private static final String PASSWORD = "Password123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private TagRepository tagRepository;

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
    void listRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/tags"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void listReturnsOnlyOwnedTagsAsDeterministicallyOrderedArray() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        Tag zeta = createTag(owner, "zeta", "zeta");
        Tag alpha = createTag(owner, "Alpha", "alpha");
        Tag beta = createTag(owner, "beta", "beta");
        createTag(other, "Aardvark", "aardvark");
        Cookie accessToken = login(owner.getEmail());

        MvcResult result = mockMvc.perform(get("/api/tags").cookie(accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].id").value(alpha.getId()))
                .andExpect(jsonPath("$[0].name").value("Alpha"))
                .andExpect(jsonPath("$[1].id").value(beta.getId()))
                .andExpect(jsonPath("$[2].name").value("zeta"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        assertThat(body.toString()).doesNotContain("normalizedName", "accountId", "\"account\"");
        assertThat(new long[] {
                body.get(0).get("id").longValue(),
                body.get(1).get("id").longValue(),
                body.get(2).get("id").longValue()})
                .containsExactly(alpha.getId(), beta.getId(), zeta.getId());
    }

    @Test
    void createNormalizesDisplayAndComparisonNamesWithServerTimestamps() throws Exception {
        Account owner = createAccount("owner@example.com");
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);
        OffsetDateTime beforeRequest = OffsetDateTime.now();

        MvcResult result = create(accessToken, csrf, "  Data    Science ")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Data Science"))
                .andExpect(jsonPath("$.normalizedName").doesNotExist())
                .andExpect(jsonPath("$.accountId").doesNotExist())
                .andReturn();
        OffsetDateTime afterRequest = OffsetDateTime.now();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        Long tagId = body.get("id").longValue();
        TagRow persisted = tagRow(tagId);
        OffsetDateTime responseCreatedAt = OffsetDateTime.parse(body.get("createdAt").stringValue());
        OffsetDateTime responseUpdatedAt = OffsetDateTime.parse(body.get("updatedAt").stringValue());
        assertThat(persisted.name()).isEqualTo("Data Science");
        assertThat(persisted.normalizedName()).isEqualTo("data science");
        assertThat(responseCreatedAt).isBetween(beforeRequest, afterRequest);
        assertThat(responseUpdatedAt).isEqualTo(responseCreatedAt);
        assertThat(persisted.createdAt()).isCloseTo(responseCreatedAt, within(1, ChronoUnit.MICROS));
        assertThat(persisted.updatedAt()).isEqualTo(persisted.createdAt());
    }

    @Test
    void duplicateComparisonIsScopedToCurrentAccount() throws Exception {
        Account first = createAccount("first@example.com");
        Account second = createAccount("second@example.com");
        Cookie firstToken = login(first.getEmail());
        Cookie secondToken = login(second.getEmail());

        create(firstToken, fetchCsrf(firstToken), "Study").andExpect(status().isCreated());
        create(firstToken, fetchCsrf(firstToken), "\u00A0Study\u00A0")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TAG_ALREADY_EXISTS"));
        create(firstToken, fetchCsrf(firstToken), " study ")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TAG_ALREADY_EXISTS"));
        create(firstToken, fetchCsrf(firstToken), "STUDY")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TAG_ALREADY_EXISTS"));
        create(secondToken, fetchCsrf(secondToken), " study ")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("study"));

        assertThat(tagRepository.findAllByAccount_IdOrderByNormalizedNameAscIdAsc(first.getId())).hasSize(1);
        assertThat(tagRepository.findAllByAccount_IdOrderByNormalizedNameAscIdAsc(second.getId())).hasSize(1);
    }

    @Test
    void createValidatesNameAndRequiresCsrf() throws Exception {
        Account owner = createAccount("owner@example.com");
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        create(accessToken, csrf, "   ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        create(accessToken, csrf, "x".repeat(101))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mockMvc.perform(post("/api/tags")
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"No CSRF\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(tagRepository.count()).isZero();
    }

    @Test
    void ownerRenameNormalizesNameAndUpdatesOnlyMutableTagData() throws Exception {
        Account owner = createAccount("owner@example.com");
        Tag tag = createTag(owner, "old name", "old name");
        TagRow before = tagRow(tag.getId());
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        rename(accessToken, csrf, tag.getId(), "  New    Name ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tag.getId()))
                .andExpect(jsonPath("$.name").value("New Name"));

        TagRow after = tagRow(tag.getId());
        assertThat(after.accountId()).isEqualTo(before.accountId());
        assertThat(after.name()).isEqualTo("New Name");
        assertThat(after.normalizedName()).isEqualTo("new name");
        assertThat(after.createdAt()).isEqualTo(before.createdAt());
        assertThat(after.updatedAt()).isAfter(before.updatedAt());
    }

    @Test
    void casingOnlyRenameKeepsSameTagId() throws Exception {
        Account owner = createAccount("owner@example.com");
        Tag tag = createTag(owner, "study", "study");
        Cookie accessToken = login(owner.getEmail());

        rename(accessToken, fetchCsrf(accessToken), tag.getId(), "Study")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tag.getId()))
                .andExpect(jsonPath("$.name").value("Study"));

        assertThat(tagRepository.count()).isOne();
        assertThat(tagRow(tag.getId()).normalizedName()).isEqualTo("study");
    }

    @Test
    void duplicateRenameIsRejectedWithoutChangingOriginalTag() throws Exception {
        Account owner = createAccount("owner@example.com");
        createTag(owner, "Study", "study");
        Tag target = createTag(owner, "Work", "work");
        TagRow before = tagRow(target.getId());
        Cookie accessToken = login(owner.getEmail());

        rename(accessToken, fetchCsrf(accessToken), target.getId(), " study ")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TAG_ALREADY_EXISTS"));

        assertThat(tagRow(target.getId())).isEqualTo(before);
    }

    @Test
    void renameHidesUnknownAndCrossAccountTagsAndRequiresCsrf() throws Exception {
        Account owner = createAccount("owner@example.com");
        Account other = createAccount("other@example.com");
        Tag otherTag = createTag(other, "Private", "private");
        TagRow before = tagRow(otherTag.getId());
        Cookie accessToken = login(owner.getEmail());
        CsrfExchange csrf = fetchCsrf(accessToken);

        for (Long id : new Long[] {Long.MAX_VALUE, otherTag.getId()}) {
            rename(accessToken, csrf, id, "Changed")
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));
        }
        mockMvc.perform(patch("/api/tags/{id}", otherTag.getId())
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Changed\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
        assertThat(tagRow(otherTag.getId())).isEqualTo(before);
    }

    @Test
    void renamePreservesLibraryVideoTagRelationAndSourceData() throws Exception {
        Account owner = createAccount("owner@example.com");
        YouTubeVideo source = createSource("tag-relation");
        LibraryVideo video = libraryVideoRepository.saveAndFlush(
                LibraryVideo.create(owner, source, OffsetDateTime.now()));
        Tag tag = createTag(owner, "Before", "before");
        jdbcTemplate.update(
                "INSERT INTO library_video_tags (library_video_id, tag_id) VALUES (?, ?)",
                video.getId(),
                tag.getId());
        String sourceTitle = source.getTitle();
        String sourceUrl = source.getSourceUrl();
        Cookie accessToken = login(owner.getEmail());

        rename(accessToken, fetchCsrf(accessToken), tag.getId(), "After")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(tag.getId()));

        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM library_video_tags WHERE library_video_id = ? AND tag_id = ?",
                Long.class,
                video.getId(),
                tag.getId())).isOne();
        assertThat(libraryVideoRepository.findById(video.getId())).isPresent();
        YouTubeVideo persistedSource = youTubeVideoRepository.findById(source.getId()).orElseThrow();
        assertThat(persistedSource.getTitle()).isEqualTo(sourceTitle);
        assertThat(persistedSource.getSourceUrl()).isEqualTo(sourceUrl);
    }

    private Account createAccount(String email) {
        OffsetDateTime now = OffsetDateTime.now();
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                now));
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

    private TagRow tagRow(Long tagId) {
        return jdbcTemplate.queryForObject("""
                SELECT id, account_id, name, normalized_name, created_at, updated_at
                FROM tags
                WHERE id = ?
                """,
                (resultSet, rowNumber) -> new TagRow(
                        resultSet.getLong("id"),
                        resultSet.getLong("account_id"),
                        resultSet.getString("name"),
                        resultSet.getString("normalized_name"),
                        resultSet.getObject("created_at", OffsetDateTime.class),
                        resultSet.getObject("updated_at", OffsetDateTime.class)),
                tagId);
    }

    private org.springframework.test.web.servlet.ResultActions create(
            Cookie accessToken,
            CsrfExchange csrf,
            String name) throws Exception {
        return mockMvc.perform(post("/api/tags")
                .cookie(accessToken, csrf.cookie())
                .header(csrf.headerName(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new NameBody(name))));
    }

    private org.springframework.test.web.servlet.ResultActions rename(
            Cookie accessToken,
            CsrfExchange csrf,
            Long tagId,
            String name) throws Exception {
        return mockMvc.perform(patch("/api/tags/{id}", tagId)
                .cookie(accessToken, csrf.cookie())
                .header(csrf.headerName(), csrf.token())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsBytes(new NameBody(name))));
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

    private record NameBody(String name) {
    }

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }

    private record TagRow(
            Long id,
            Long accountId,
            String name,
            String normalizedName,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt) {
    }
}
