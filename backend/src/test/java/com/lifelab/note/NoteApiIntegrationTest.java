package com.lifelab.note;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class NoteApiIntegrationTest {

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
    void globalListDetailAndPatchRequireAuthenticationAndPatchRequiresCsrf() throws Exception {
        Account owner = createAccount("note-security@example.com");
        YouTubeVideo source = createSource("note-global-security", YouTubeAvailabilityStatus.AVAILABLE);
        Long noteId = insertNote(owner.getId(), source.getId(), "Context", 4, BASE_TIME);

        mockMvc.perform(get("/api/notes"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mockMvc.perform(get("/api/notes/{id}", noteId))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        CsrfExchange guestCsrf = fetchCsrf();
        mockMvc.perform(patch("/api/notes/{id}", noteId)
                        .cookie(guestCsrf.cookie())
                        .header(guestCsrf.headerName(), guestCsrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Updated\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Cookie accessToken = login(owner.getEmail());
        mockMvc.perform(patch("/api/notes/{id}", noteId)
                        .cookie(accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Updated\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void globalListIsAccountScopedOrderedAndPaginatedDeterministically() throws Exception {
        Account owner = createAccount("note-list@example.com");
        Account other = createAccount("note-list-other@example.com");
        YouTubeVideo source = createSource("note-global-list", YouTubeAvailabilityStatus.AVAILABLE);
        Long old = insertNote(owner.getId(), source.getId(), "Old", 1, BASE_TIME.minusDays(1));
        Long equalLowerId = insertNote(owner.getId(), source.getId(), "Equal one", 2, BASE_TIME);
        Long equalHigherId = insertNote(owner.getId(), source.getId(), "Equal two", 3, BASE_TIME);
        insertNote(other.getId(), source.getId(), "Private", 4, BASE_TIME.plusDays(1));
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/notes").cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.items[0].id").value(equalHigherId))
                .andExpect(jsonPath("$.items[1].id").value(equalLowerId))
                .andExpect(jsonPath("$.items[2].id").value(old));

        mockMvc.perform(get("/api/notes")
                        .queryParam("page", "0")
                        .queryParam("size", "2")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
        mockMvc.perform(get("/api/notes")
                        .queryParam("page", "1")
                        .queryParam("size", "2")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(old));
    }

    @Test
    void paginationValidationUsesStandardErrorContract() throws Exception {
        Account owner = createAccount("note-pagination@example.com");
        Cookie token = login(owner.getEmail());

        for (String[] invalid : new String[][] {
                {"page", "-1", "page"},
                {"size", "0", "size"},
                {"size", "101", "size"}}) {
            mockMvc.perform(get("/api/notes")
                            .queryParam(invalid[0], invalid[1])
                            .cookie(token))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fieldErrors." + invalid[2]).exists());
        }
    }

    @Test
    void contentSearchIsCaseInsensitivePartialTrimmedAndBlankMeansUnfiltered() throws Exception {
        Account owner = createAccount("note-search@example.com");
        Account other = createAccount("note-search-other@example.com");
        YouTubeVideo source = createSource("note-search-source", YouTubeAvailabilityStatus.AVAILABLE);
        Long matching = insertNote(
                owner.getId(), source.getId(), "Distributed Systems Study", 1, BASE_TIME);
        insertNote(owner.getId(), source.getId(), "Cooking", 2, BASE_TIME.minusSeconds(1));
        insertNote(other.getId(), source.getId(), "Private distributed systems", 3, BASE_TIME.plusDays(1));
        Cookie token = login(owner.getEmail());

        for (String query : new String[] {"distributed", "SyStEmS", "buted Sys", "  STUDY  "}) {
            mockMvc.perform(get("/api/notes").queryParam("q", query).cookie(token))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.items[0].id").value(matching));
        }
        mockMvc.perform(get("/api/notes").queryParam("q", "  \t  ").cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mockMvc.perform(get("/api/notes").queryParam("q", "no match").cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.totalElements").value(0))
                .andExpect(jsonPath("$.totalPages").value(0));
    }

    @Test
    void organizationTimestampSourceSearchSortingAndFilteredPaginationCompose() throws Exception {
        Account owner = createAccount("note-v2-owner@example.com");
        Account other = createAccount("note-v2-other@example.com");
        YouTubeVideo source = createSource("note-v2-source", YouTubeAvailabilityStatus.AVAILABLE);
        jdbcTemplate.update(
                "UPDATE youtube_videos SET title = 'Deep Work Lecture', channel_name = 'Focus Academy' WHERE id = ?",
                source.getId());
        Long categoryId = insertCategory(owner.getId(), "Learning", "learning");
        Long otherCategoryId = insertCategory(owner.getId(), "Other", "other");
        Long foreignCategoryId = insertCategory(other.getId(), "Private", "private");
        Long alphaTagId = insertTag(owner.getId(), "Alpha", "alpha");
        Long betaTagId = insertTag(owner.getId(), "Beta", "beta");
        Long foreignTagId = insertTag(other.getId(), "Private", "private");

        Long oldTimestamped = insertNote(
                owner.getId(), source.getId(), "First practice", 10, BASE_TIME.minusDays(1));
        Long newTimestamped = insertNote(
                owner.getId(), source.getId(), "Second practice", 20, BASE_TIME);
        Long newWithoutTimestamp = insertNote(
                owner.getId(), source.getId(), "Third practice", null, BASE_TIME);
        Long oldWithoutTimestamp = insertNote(
                owner.getId(), source.getId(), "Review", null, BASE_TIME.minusDays(2));
        Long wrongCategory = insertNote(
                owner.getId(), source.getId(), "First practice", 30, BASE_TIME.plusDays(1));
        Long foreignNote = insertNote(
                other.getId(), source.getId(), "First practice", 40, BASE_TIME.plusDays(2));

        organizeNote(oldTimestamped, categoryId, alphaTagId);
        organizeNote(newTimestamped, categoryId, alphaTagId);
        organizeNote(newWithoutTimestamp, categoryId, betaTagId);
        organizeNote(oldWithoutTimestamp, categoryId, betaTagId);
        organizeNote(wrongCategory, otherCategoryId, alphaTagId);
        organizeNote(foreignNote, foreignCategoryId, foreignTagId);
        jdbcTemplate.update("UPDATE notes SET updated_at = ? WHERE id IN (?, ?)",
                BASE_TIME, oldTimestamped, newTimestamped);
        jdbcTemplate.update("UPDATE notes SET updated_at = ? WHERE id = ?",
                BASE_TIME.plusHours(1), newWithoutTimestamp);
        jdbcTemplate.update("UPDATE notes SET updated_at = ? WHERE id = ?",
                BASE_TIME.plusHours(2), oldWithoutTimestamp);
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/notes/{id}", newTimestamped).cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category.id").value(categoryId))
                .andExpect(jsonPath("$.tags.length()").value(1))
                .andExpect(jsonPath("$.tags[0].id").value(alphaTagId));

        mockMvc.perform(get("/api/notes")
                        .param("categoryId", categoryId.toString())
                        .param("tagId", alphaTagId.toString(), betaTagId.toString())
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.items[0].category.id").value(categoryId))
                .andExpect(jsonPath("$.items[0].tags").isArray());

        mockMvc.perform(get("/api/notes")
                        .param("hasTimestamp", "true")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(3));
        mockMvc.perform(get("/api/notes")
                        .param("hasTimestamp", "false")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));

        MvcResult ascending = mockMvc.perform(get("/api/notes")
                        .param("q", "academy")
                        .param("categoryId", categoryId.toString())
                        .param("tagId", alphaTagId.toString(), betaTagId.toString())
                        .param("hasTimestamp", "false")
                        .param("sortBy", "createdAt")
                        .param("sortDirection", "asc")
                        .cookie(token))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(itemIds(ascending)).containsExactly(oldWithoutTimestamp, newWithoutTimestamp);

        MvcResult descending = mockMvc.perform(get("/api/notes")
                        .param("categoryId", categoryId.toString())
                        .param("hasTimestamp", "false")
                        .param("sortBy", "updatedAt")
                        .param("sortDirection", "desc")
                        .cookie(token))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(itemIds(descending)).containsExactly(oldWithoutTimestamp, newWithoutTimestamp);

        MvcResult firstPage = mockMvc.perform(get("/api/notes")
                        .param("categoryId", categoryId.toString())
                        .param("tagId", alphaTagId.toString())
                        .param("sortBy", "updatedAt")
                        .param("sortDirection", "asc")
                        .param("page", "0")
                        .param("size", "1")
                        .cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andReturn();
        MvcResult secondPage = mockMvc.perform(get("/api/notes")
                        .param("categoryId", categoryId.toString())
                        .param("tagId", alphaTagId.toString())
                        .param("sortBy", "updatedAt")
                        .param("sortDirection", "asc")
                        .param("page", "1")
                        .param("size", "1")
                        .cookie(token))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(itemIds(firstPage)).containsExactly(oldTimestamped);
        assertThat(itemIds(secondPage)).containsExactly(newTimestamped);
    }

    @Test
    void organizationFiltersAreOwnershipSafeAndSortParametersAreValidated() throws Exception {
        Account owner = createAccount("note-v2-validation-owner@example.com");
        Account other = createAccount("note-v2-validation-other@example.com");
        Long foreignCategoryId = insertCategory(other.getId(), "Private", "private");
        Long foreignTagId = insertTag(other.getId(), "Private", "private");
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/notes")
                        .param("categoryId", foreignCategoryId.toString())
                        .cookie(token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CATEGORY_NOT_FOUND"));
        mockMvc.perform(get("/api/notes")
                        .param("tagId", foreignTagId.toString())
                        .cookie(token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));

        for (String[] invalid : new String[][] {
                {"sortBy", "deadline", "sortBy"},
                {"sortDirection", "up", "sortDirection"}}) {
            mockMvc.perform(get("/api/notes")
                            .param(invalid[0], invalid[1])
                            .cookie(token))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fieldErrors." + invalid[2]).exists());
        }
    }

    @Test
    void detailUsesSafeAccountScopedOwnership() throws Exception {
        Account owner = createAccount("note-detail@example.com");
        Account other = createAccount("note-detail-other@example.com");
        YouTubeVideo source = createSource("note-detail-source", YouTubeAvailabilityStatus.AVAILABLE);
        Long ownNote = insertNote(owner.getId(), source.getId(), "Own", 7, BASE_TIME);
        Long privateNote = insertNote(other.getId(), source.getId(), "Private", 8, BASE_TIME);
        AuthenticatedSession session = authenticate(owner.getEmail());

        mockMvc.perform(get("/api/notes/{id}", ownNote).cookie(session.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(ownNote))
                .andExpect(jsonPath("$.content").value("Own"))
                .andExpect(jsonPath("$.accountId").doesNotExist());

        for (Long noteId : new Long[] {999999L, privateNote}) {
            mockMvc.perform(get("/api/notes/{id}", noteId).cookie(session.accessToken()))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOTE_NOT_FOUND"));
            mockMvc.perform(patch("/api/notes/{id}", noteId)
                            .cookie(session.accessToken(), session.csrf().cookie())
                            .header(session.csrf().headerName(), session.csrf().token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"content\":\"Must not update\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("NOTE_NOT_FOUND"));
        }
        assertThat(jdbcTemplate.queryForObject(
                "SELECT content FROM notes WHERE id = ?", String.class, privateNote))
                .isEqualTo("Private");
    }

    @Test
    void updateChangesOnlyContentAndUpdatedAtDespiteExtraClientFields() throws Exception {
        Account owner = createAccount("note-update@example.com");
        Account other = createAccount("note-update-other@example.com");
        YouTubeVideo source = createSource("note-update-source", YouTubeAvailabilityStatus.AVAILABLE);
        YouTubeVideo otherSource = createSource("note-update-other-source", YouTubeAvailabilityStatus.AVAILABLE);
        Long noteId = insertNote(owner.getId(), source.getId(), "Original", 17, BASE_TIME);
        AuthenticatedSession session = authenticate(owner.getEmail());

        mockMvc.perform(patch("/api/notes/{id}", noteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"content":"Updated content","accountId":%d,
                                 "youtubeSourceId":%d,"timestampSeconds":999}
                                """.formatted(other.getId(), otherSource.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Updated content"))
                .andExpect(jsonPath("$.timestampSeconds").value(17))
                .andExpect(jsonPath("$.youtubeSource.id").value(source.getId()))
                .andExpect(jsonPath("$.createdAt").value("2026-03-15T12:00:00Z"))
                .andExpect(jsonPath("$.updatedAt").value(org.hamcrest.Matchers.not("2026-03-15T12:00:00Z")));

        Map<String, Object> persisted = jdbcTemplate.queryForMap("""
                SELECT account_id, youtube_source_id, content, timestamp_seconds
                FROM notes WHERE id = ?
                """, noteId);
        assertThat(((Number) persisted.get("account_id")).longValue()).isEqualTo(owner.getId());
        assertThat(((Number) persisted.get("youtube_source_id")).longValue()).isEqualTo(source.getId());
        assertThat(((Number) persisted.get("timestamp_seconds")).intValue()).isEqualTo(17);
        assertThat(persisted.get("content")).isEqualTo("Updated content");
        assertThat(timestamp("SELECT created_at FROM notes WHERE id = ?", noteId)).isEqualTo(BASE_TIME);
        assertThat(timestamp("SELECT updated_at FROM notes WHERE id = ?", noteId)).isAfter(BASE_TIME);
    }

    @Test
    void blankAndUnicodeWhitespaceUpdatesFailWithoutMutation() throws Exception {
        Account owner = createAccount("note-update-validation@example.com");
        YouTubeVideo source = createSource("note-update-validation-source", YouTubeAvailabilityStatus.AVAILABLE);
        Long noteId = insertNote(owner.getId(), source.getId(), "Original", 9, BASE_TIME);
        AuthenticatedSession session = authenticate(owner.getEmail());

        for (String invalidContent : new String[] {"     ", "\u00A0\u2003"}) {
            String body = objectMapper.writeValueAsString(Map.of("content", invalidContent));
            mockMvc.perform(patch("/api/notes/{id}", noteId)
                            .cookie(session.accessToken(), session.csrf().cookie())
                            .header(session.csrf().headerName(), session.csrf().token())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.fieldErrors.content").exists());
        }

        Map<String, Object> persisted = jdbcTemplate.queryForMap(
                "SELECT content FROM notes WHERE id = ?", noteId);
        assertThat(persisted.get("content")).isEqualTo("Original");
        assertThat(timestamp("SELECT updated_at FROM notes WHERE id = ?", noteId)).isEqualTo(BASE_TIME);
    }

    @Test
    void noteRemainsGloballyReadableAfterLibraryDeletionAndWithUnavailableSource() throws Exception {
        Account owner = createAccount("note-preservation@example.com");
        YouTubeVideo source = createSource("note-unavailable", YouTubeAvailabilityStatus.UNAVAILABLE);
        LibraryVideo video = createLibraryVideo(owner, source);
        Long noteId = insertNote(owner.getId(), source.getId(), "Preserved context", null, BASE_TIME);
        libraryVideoRepository.delete(video);
        libraryVideoRepository.flush();
        Cookie token = login(owner.getEmail());

        mockMvc.perform(get("/api/notes").cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(noteId))
                .andExpect(jsonPath("$.items[0].youtubeSource.availabilityStatus").value("UNAVAILABLE"));
        mockMvc.perform(get("/api/notes/{id}", noteId).cookie(token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(noteId))
                .andExpect(jsonPath("$.youtubeSource.id").value(source.getId()))
                .andExpect(jsonPath("$.youtubeSource.availabilityStatus").value("UNAVAILABLE"));
    }

    @Test
    void globalOperationsDoNotMutateRelatedBusinessDataOrCallYoutube() throws Exception {
        Account owner = createAccount("note-no-mutation@example.com");
        YouTubeVideo source = createSource("note-no-mutation-source", YouTubeAvailabilityStatus.AVAILABLE);
        LibraryVideo video = createLibraryVideo(owner, source);
        Long noteId = insertNote(owner.getId(), source.getId(), "Original", 11, BASE_TIME);
        Tag tag = tagRepository.saveAndFlush(Tag.create(owner, "Context", "context", BASE_TIME));
        jdbcTemplate.update(
                "INSERT INTO library_video_tags (library_video_id, tag_id) VALUES (?, ?)",
                video.getId(), tag.getId());
        jdbcTemplate.update("""
                INSERT INTO watch_sessions (
                    library_video_id, started_at, ended_at, last_heartbeat_at,
                    watch_time_seconds, validity_status
                ) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 30, 'VALID')
                """, video.getId());
        insertTask(owner.getId(), noteId);
        AuthenticatedSession session = authenticate(owner.getEmail());
        Map<String, Long> countsBefore = tableCounts();
        OffsetDateTime videoUpdatedAt = timestamp(
                "SELECT updated_at FROM library_videos WHERE id = ?", video.getId());
        OffsetDateTime sourceUpdatedAt = timestamp(
                "SELECT updated_at FROM youtube_videos WHERE id = ?", source.getId());
        Map<String, Object> taskBefore = jdbcTemplate.queryForMap(
                "SELECT source_note_id, source_status, title, status, updated_at FROM tasks");

        mockMvc.perform(get("/api/notes").queryParam("q", "original").cookie(session.accessToken()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/notes/{id}", noteId).cookie(session.accessToken()))
                .andExpect(status().isOk());
        mockMvc.perform(patch("/api/notes/{id}", noteId)
                        .cookie(session.accessToken(), session.csrf().cookie())
                        .header(session.csrf().headerName(), session.csrf().token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":\"Updated only\"}"))
                .andExpect(status().isOk());

        assertThat(tableCounts()).isEqualTo(countsBefore);
        assertThat(timestamp("SELECT updated_at FROM library_videos WHERE id = ?", video.getId()))
                .isEqualTo(videoUpdatedAt);
        assertThat(timestamp("SELECT updated_at FROM youtube_videos WHERE id = ?", source.getId()))
                .isEqualTo(sourceUpdatedAt);
        assertThat(jdbcTemplate.queryForMap(
                "SELECT source_note_id, source_status, title, status, updated_at FROM tasks"))
                .isEqualTo(taskBefore);
        verifyNoInteractions(youTubeMetadataClient);
    }

    private Account createAccount(String email) {
        return accountRepository.saveAndFlush(Account.create(
                email,
                passwordEncoder.encode(PASSWORD),
                "Test User",
                BASE_TIME));
    }

    private YouTubeVideo createSource(String youtubeVideoId, YouTubeAvailabilityStatus status) {
        return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                "Title",
                "Channel",
                "https://image.example/" + youtubeVideoId + ".jpg",
                100,
                BASE_TIME,
                status,
                BASE_TIME));
    }

    private LibraryVideo createLibraryVideo(Account account, YouTubeVideo source) {
        return libraryVideoRepository.saveAndFlush(LibraryVideo.create(account, source, BASE_TIME));
    }

    private Long insertNote(
            Long accountId,
            Long youtubeSourceId,
            String content,
            Integer timestampSeconds,
            OffsetDateTime createdAt) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO notes (
                    account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, accountId, youtubeSourceId, content, timestampSeconds, createdAt, createdAt);
    }

    private Long insertCategory(Long accountId, String name, String normalizedName) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO categories (account_id, name, normalized_name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, accountId, name, normalizedName, BASE_TIME, BASE_TIME);
    }

    private Long insertTag(Long accountId, String name, String normalizedName) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO tags (account_id, name, normalized_name, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                RETURNING id
                """, Long.class, accountId, name, normalizedName, BASE_TIME, BASE_TIME);
    }

    private void organizeNote(Long noteId, Long categoryId, Long tagId) {
        jdbcTemplate.update("UPDATE notes SET category_id = ? WHERE id = ?", categoryId, noteId);
        jdbcTemplate.update("INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)", noteId, tagId);
    }

    private java.util.List<Long> itemIds(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsByteArray())
                .get("items")
                .valueStream()
                .map(item -> item.get("id").longValue())
                .toList();
    }

    private void insertTask(Long accountId, Long noteId) {
        jdbcTemplate.update("""
                INSERT INTO tasks (
                    account_id, source_note_id, source_status, title, description,
                    status, deadline, created_at, updated_at
                ) VALUES (?, ?, 'HAS_SOURCE', 'Task', NULL, 'NOT_STARTED', NULL, ?, ?)
                """, accountId, noteId, BASE_TIME, BASE_TIME);
    }

    private Map<String, Long> tableCounts() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String table : new String[] {
                "accounts", "youtube_videos", "library_videos", "tags",
                "library_video_tags", "watch_sessions", "notes", "tasks"}) {
            counts.put(table, jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class));
        }
        return counts;
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
