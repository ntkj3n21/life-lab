package com.lifelab.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
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
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
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
class TaskReadSearchApiIntegrationTest {

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
        private PasswordEncoder passwordEncoder;

        @Autowired
        private JdbcTemplate jdbcTemplate;

        @MockitoBean
        private YouTubeMetadataClient youTubeMetadataClient;

        @BeforeEach
        void cleanDatabase() {
                jdbcTemplate.execute("""
                                TRUNCATE TABLE task_tags, note_tags, categories, tasks, notes, watch_sessions,
                                        library_video_tags, tags,
                                        library_audio, audio_sources,
                                        library_images, image_sources,
                                        library_videos, youtube_videos, accounts
                                        RESTART IDENTITY CASCADE
                                """);
        }

        @AfterEach
        void removeFixtures() {
                cleanDatabase();
        }

        @Test
        void listAndDetailRequireAuthentication() throws Exception {
                Account owner = createAccount("task-read-security@example.com");
                Long taskId = insertTask(owner.getId(), null, "INDEPENDENT", "Task", null,
                                "NOT_STARTED", null, BASE_TIME);

                mockMvc.perform(get("/api/tasks"))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
                mockMvc.perform(get("/api/tasks/{taskId}", taskId))
                                .andExpect(status().isUnauthorized())
                                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        }

        @Test
        void listIsAccountScopedDeterministicallyOrderedAndDatabasePaginated() throws Exception {
                Account owner = createAccount("task-list-owner@example.com");
                Account other = createAccount("task-list-other@example.com");
                Long oldest = insertTask(owner.getId(), null, "INDEPENDENT", "Oldest", null,
                                "NOT_STARTED", null, BASE_TIME.minusDays(1));
                Long sameTimeFirst = insertTask(owner.getId(), null, "INDEPENDENT", "Same first", null,
                                "NOT_STARTED", null, BASE_TIME);
                Long sameTimeSecond = insertTask(owner.getId(), null, "INDEPENDENT", "Same second", null,
                                "NOT_STARTED", null, BASE_TIME);
                insertTask(other.getId(), null, "INDEPENDENT", "Foreign matching", null,
                                "NOT_STARTED", null, BASE_TIME.plusDays(1));
                Cookie accessToken = login(owner.getEmail());

                JsonNode firstPage = getJson("/api/tasks?page=0&size=2", accessToken);
                assertThat(ids(firstPage)).containsExactly(sameTimeSecond, sameTimeFirst);
                assertThat(firstPage.get("page").intValue()).isZero();
                assertThat(firstPage.get("size").intValue()).isEqualTo(2);
                assertThat(firstPage.get("totalElements").longValue()).isEqualTo(3);
                assertThat(firstPage.get("totalPages").intValue()).isEqualTo(2);

                JsonNode secondPage = getJson("/api/tasks?page=1&size=2", accessToken);
                assertThat(ids(secondPage)).containsExactly(oldest);
        }

        @Test
        void listRejectsInvalidPaginationWithStandardValidationError() throws Exception {
                Account owner = createAccount("task-pagination@example.com");
                Cookie accessToken = login(owner.getEmail());

                for (String path : new String[] {
                                "/api/tasks?page=-1",
                                "/api/tasks?size=0",
                                "/api/tasks?size=101" }) {
                        mockMvc.perform(get(path).cookie(accessToken))
                                        .andExpect(status().isBadRequest())
                                        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
                }
        }

        @Test
        void keywordSearchUsesTitleOrDescriptionWithNormalizedContainsSemantics() throws Exception {
                Account owner = createAccount("task-search-owner@example.com");
                Account other = createAccount("task-search-other@example.com");
                Long titleMatch = insertTask(owner.getId(), null, "INDEPENDENT", "PROJECT review", null,
                                "NOT_STARTED", null, BASE_TIME);
                Long descriptionMatch = insertTask(owner.getId(), null, "INDEPENDENT", "Read", "Apply project pattern",
                                "NOT_STARTED", null, BASE_TIME.minusMinutes(1));
                insertTask(owner.getId(), null, "INDEPENDENT", "Unrelated", null,
                                "NOT_STARTED", null, BASE_TIME.minusMinutes(2));
                insertTask(other.getId(), null, "INDEPENDENT", "Project foreign", "project",
                                "NOT_STARTED", null, BASE_TIME.plusMinutes(1));
                Cookie accessToken = login(owner.getEmail());

                assertThat(ids(getJson("/api/tasks?q=project", accessToken)))
                                .containsExactly(titleMatch, descriptionMatch);
                assertThat(ids(getJson("/api/tasks?q=OJECT", accessToken)))
                                .containsExactly(titleMatch, descriptionMatch);
                assertThat(ids(getJsonWithQuery("  project  ", accessToken)))
                                .containsExactly(titleMatch, descriptionMatch);
                assertThat(ids(getJsonWithQuery("   ", accessToken))).hasSize(3);

                JsonNode noMatch = getJson("/api/tasks?q=missing-keyword", accessToken);
                assertThat(ids(noMatch)).isEmpty();
                assertThat(noMatch.get("totalElements").longValue()).isZero();
                assertThat(noMatch.get("totalPages").intValue()).isZero();
        }

        @Test
        void statusFilterSupportsLockedValuesAndRejectsInvalidOrBlankValues() throws Exception {
                Account owner = createAccount("task-status@example.com");
                Long notStarted = insertTask(owner.getId(), null, "INDEPENDENT", "Not started", null,
                                "NOT_STARTED", null, BASE_TIME);
                Long inProgress = insertTask(owner.getId(), null, "INDEPENDENT", "In progress", null,
                                "IN_PROGRESS", null, BASE_TIME);
                Long completed = insertTask(owner.getId(), null, "INDEPENDENT", "Completed", null,
                                "COMPLETED", null, BASE_TIME);
                Cookie accessToken = login(owner.getEmail());

                assertThat(ids(getJson("/api/tasks?status=NOT_STARTED", accessToken))).containsExactly(notStarted);
                assertThat(ids(getJson("/api/tasks?status=IN_PROGRESS", accessToken))).containsExactly(inProgress);
                assertThat(ids(getJson("/api/tasks?status=COMPLETED", accessToken))).containsExactly(completed);

                for (String value : new String[] { "OVERDUE", "" }) {
                        mockMvc.perform(get("/api/tasks").param("status", value).cookie(accessToken))
                                        .andExpect(status().isBadRequest())
                                        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                                        .andExpect(jsonPath("$.fieldErrors.status").exists());
                }
        }

        @Test
        void deadlineBoundsAreInclusiveExcludeNullAndValidateRanges() throws Exception {
                Account owner = createAccount("task-deadline-filter@example.com");
                Long early = insertTask(owner.getId(), null, "INDEPENDENT", "Early", null,
                                "NOT_STARTED", LocalDate.of(2026, 8, 1), BASE_TIME);
                Long middle = insertTask(owner.getId(), null, "INDEPENDENT", "Middle", null,
                                "NOT_STARTED", LocalDate.of(2026, 8, 15), BASE_TIME.minusMinutes(1));
                Long late = insertTask(owner.getId(), null, "INDEPENDENT", "Late", null,
                                "NOT_STARTED", LocalDate.of(2026, 8, 31), BASE_TIME.minusMinutes(2));
                insertTask(owner.getId(), null, "INDEPENDENT", "No deadline", null,
                                "NOT_STARTED", null, BASE_TIME.plusMinutes(1));
                Cookie accessToken = login(owner.getEmail());

                assertThat(ids(getJson("/api/tasks?deadlineFrom=2026-08-15", accessToken)))
                                .containsExactly(middle, late);
                assertThat(ids(getJson("/api/tasks?deadlineTo=2026-08-15", accessToken)))
                                .containsExactly(early, middle);
                assertThat(ids(getJson(
                                "/api/tasks?deadlineFrom=2026-08-01&deadlineTo=2026-08-31", accessToken)))
                                .containsExactly(early, middle, late);

                mockMvc.perform(get("/api/tasks")
                                .param("deadlineFrom", "2026-09-01")
                                .param("deadlineTo", "2026-08-01")
                                .cookie(accessToken))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                                .andExpect(jsonPath("$.fieldErrors.deadlineFrom").exists())
                                .andExpect(jsonPath("$.fieldErrors.deadlineTo").exists());
        }

        @Test
        void keywordStatusAndDeadlineGroupsCombineWithAnd() throws Exception {
                Account owner = createAccount("task-combined@example.com");
                Long match = insertTask(owner.getId(), null, "INDEPENDENT", "Project delivery", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME);
                insertTask(owner.getId(), null, "INDEPENDENT", "Project completed", null,
                                "COMPLETED", LocalDate.of(2026, 8, 20), BASE_TIME.minusMinutes(1));
                insertTask(owner.getId(), null, "INDEPENDENT", "Project outside", null,
                                "IN_PROGRESS", LocalDate.of(2026, 9, 1), BASE_TIME.minusMinutes(2));
                insertTask(owner.getId(), null, "INDEPENDENT", "Other work", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME.minusMinutes(3));
                Cookie accessToken = login(owner.getEmail());

                JsonNode result = getJson("/api/tasks?q=project&status=IN_PROGRESS"
                                + "&deadlineFrom=2026-08-01&deadlineTo=2026-08-31", accessToken);
                assertThat(ids(result)).containsExactly(match);
        }

        @Test
        void libraryVideoFilterUsesExactOwnedSourceAndComposesWithExistingFilters() throws Exception {
                Account owner = createAccount("task-video-filter-owner@example.com");
                Account other = createAccount("task-video-filter-other@example.com");
                YouTubeVideo source = createSource("task-video-filter-source", YouTubeAvailabilityStatus.AVAILABLE);
                YouTubeVideo otherSource = createSource(
                                "task-video-filter-other-source", YouTubeAvailabilityStatus.AVAILABLE);
                Long libraryVideoId = insertLibraryVideo(owner.getId(), source.getId());
                Long foreignLibraryVideoId = insertLibraryVideo(other.getId(), source.getId());
                Long sourceNoteId = insertNote(owner.getId(), source.getId(), "Exact source");
                Long otherSourceNoteId = insertNote(owner.getId(), otherSource.getId(), "Other source");
                Long foreignNoteId = insertNote(other.getId(), source.getId(), "Foreign source");

                Long newestMatch = insertTask(owner.getId(), sourceNoteId, "HAS_SOURCE", "Project newest", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME.plusMinutes(2));
                Long olderMatch = insertTask(owner.getId(), sourceNoteId, "HAS_SOURCE", "Project older", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME.plusMinutes(1));
                insertTask(owner.getId(), sourceNoteId, "HAS_SOURCE", "Wrong status", null,
                                "COMPLETED", LocalDate.of(2026, 8, 20), BASE_TIME);
                insertTask(owner.getId(), otherSourceNoteId, "HAS_SOURCE", "Project other source", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME);
                insertTask(owner.getId(), null, "INDEPENDENT", "Project independent", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME);
                insertTask(owner.getId(), null, "SOURCE_MISSING", "Project missing", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME);
                insertTask(other.getId(), foreignNoteId, "HAS_SOURCE", "Project foreign", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME.plusMinutes(3));
                Cookie accessToken = login(owner.getEmail());

                JsonNode firstPage = getJson("/api/tasks?libraryVideoId=" + libraryVideoId
                                + "&q=project&status=IN_PROGRESS&deadlineFrom=2026-08-20"
                                + "&deadlineTo=2026-08-20&page=0&size=1", accessToken);
                assertThat(ids(firstPage)).containsExactly(newestMatch);
                assertThat(firstPage.get("totalElements").longValue()).isEqualTo(2);
                assertThat(firstPage.get("totalPages").intValue()).isEqualTo(2);

                JsonNode secondPage = getJson("/api/tasks?libraryVideoId=" + libraryVideoId
                                + "&q=project&status=IN_PROGRESS&deadlineFrom=2026-08-20"
                                + "&deadlineTo=2026-08-20&page=1&size=1", accessToken);
                assertThat(ids(secondPage)).containsExactly(olderMatch);

                for (Long inaccessibleId : new Long[] { 999999L, foreignLibraryVideoId }) {
                        mockMvc.perform(get("/api/tasks")
                                        .param("libraryVideoId", inaccessibleId.toString())
                                        .cookie(accessToken))
                                        .andExpect(status().isNotFound())
                                        .andExpect(jsonPath("$.code").value("LIBRARY_VIDEO_NOT_FOUND"));
                }
        }

        @Test
        void libraryImageFilterUsesExactOwnedSourceAndComposesWithExistingFilters() throws Exception {
                Account owner = createAccount("task-image-filter-owner@example.com");
                Account other = createAccount("task-image-filter-other@example.com");

                Long imageSourceId = insertImageSource("task-image-filter-source");
                Long otherImageSourceId = insertImageSource("task-image-filter-other-source");

                Long libraryImageId = insertLibraryImage(owner.getId(), imageSourceId);
                Long foreignLibraryImageId = insertLibraryImage(other.getId(), imageSourceId);

                Long sourceNoteId = insertImageNote(owner.getId(), imageSourceId, "Exact image source");

                Long otherSourceNoteId = insertImageNote(owner.getId(), otherImageSourceId, "Other image source");

                Long foreignNoteId = insertImageNote(other.getId(), imageSourceId, "Foreign image source");

                Long audioSourceId = insertAudioSource("task-image-filter-audio");
                Long audioNoteId = insertAudioNote(owner.getId(), audioSourceId, "Audio context");

                YouTubeVideo videoSource = createSource(
                                "task-image-filter-video",
                                YouTubeAvailabilityStatus.AVAILABLE);

                Long videoNoteId = insertNote(owner.getId(), videoSource.getId(), "Video context");

                Long newestMatch = insertTask(
                                owner.getId(),
                                sourceNoteId,
                                "HAS_SOURCE",
                                "Project image newest",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME.plusMinutes(2));

                Long olderMatch = insertTask(
                                owner.getId(),
                                sourceNoteId,
                                "HAS_SOURCE",
                                "Project image older",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME.plusMinutes(1));

                insertTask(
                                owner.getId(),
                                sourceNoteId,
                                "HAS_SOURCE",
                                "Project wrong status",
                                null,
                                "COMPLETED",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME);

                insertTask(
                                owner.getId(),
                                otherSourceNoteId,
                                "HAS_SOURCE",
                                "Project other image",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME);

                insertTask(
                                owner.getId(),
                                audioNoteId,
                                "HAS_SOURCE",
                                "Project audio",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME);

                insertTask(
                                owner.getId(),
                                videoNoteId,
                                "HAS_SOURCE",
                                "Project video",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME);

                insertTask(
                                owner.getId(),
                                null,
                                "INDEPENDENT",
                                "Project independent",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME);

                insertTask(
                                owner.getId(),
                                null,
                                "SOURCE_MISSING",
                                "Project missing",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME);

                insertTask(
                                other.getId(),
                                foreignNoteId,
                                "HAS_SOURCE",
                                "Project foreign",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME.plusMinutes(3));

                Cookie accessToken = login(owner.getEmail());

                JsonNode firstPage = getJson(
                                "/api/tasks?libraryImageId=" + libraryImageId
                                                + "&q=project"
                                                + "&status=IN_PROGRESS"
                                                + "&sourceStatus=HAS_SOURCE"
                                                + "&deadlineFrom=2026-08-20"
                                                + "&deadlineTo=2026-08-20"
                                                + "&page=0&size=1",
                                accessToken);

                assertThat(ids(firstPage)).containsExactly(newestMatch);
                assertThat(firstPage.get("totalElements").longValue()).isEqualTo(2);
                assertThat(firstPage.get("totalPages").intValue()).isEqualTo(2);

                JsonNode secondPage = getJson(
                                "/api/tasks?libraryImageId=" + libraryImageId
                                                + "&q=project"
                                                + "&status=IN_PROGRESS"
                                                + "&sourceStatus=HAS_SOURCE"
                                                + "&deadlineFrom=2026-08-20"
                                                + "&deadlineTo=2026-08-20"
                                                + "&page=1&size=1",
                                accessToken);

                assertThat(ids(secondPage)).containsExactly(olderMatch);

                for (Long inaccessibleId : new Long[] { 999999L, foreignLibraryImageId }) {
                        mockMvc.perform(get("/api/tasks")
                                        .param("libraryImageId", inaccessibleId.toString())
                                        .cookie(accessToken))
                                        .andExpect(status().isNotFound())
                                        .andExpect(jsonPath("$.code").value("LIBRARY_IMAGE_NOT_FOUND"));
                }
        }

        @Test
        void libraryAudioFilterUsesExactOwnedSourceAndComposesWithOrganizationFilters()
                        throws Exception {

                Account owner = createAccount("task-audio-filter-owner@example.com");
                Account other = createAccount("task-audio-filter-other@example.com");

                Long audioSourceId = insertAudioSource("task-audio-filter-source");
                Long otherAudioSourceId = insertAudioSource("task-audio-filter-other-source");

                Long libraryAudioId = insertLibraryAudio(owner.getId(), audioSourceId);
                Long foreignLibraryAudioId = insertLibraryAudio(other.getId(), audioSourceId);

                Long sourceNoteId = insertAudioNote(owner.getId(), audioSourceId, "Exact audio source");

                Long otherSourceNoteId = insertAudioNote(owner.getId(), otherAudioSourceId, "Other audio source");

                Long categoryId = insertCategory(owner.getId(), "Audio learning", "audio-learning");

                Long otherCategoryId = insertCategory(owner.getId(), "Other audio", "other-audio");

                Long tagId = insertTag(owner.getId(), "Audio", "audio");

                Long otherTagId = insertTag(owner.getId(), "Other", "other");

                Long firstMatch = insertTask(
                                owner.getId(),
                                sourceNoteId,
                                "HAS_SOURCE",
                                "Audio first",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME);

                Long secondMatch = insertTask(
                                owner.getId(),
                                sourceNoteId,
                                "HAS_SOURCE",
                                "Audio second",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 21),
                                BASE_TIME.plusMinutes(1));

                Long wrongCategory = insertTask(
                                owner.getId(),
                                sourceNoteId,
                                "HAS_SOURCE",
                                "Audio wrong category",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME.plusMinutes(2));

                Long wrongTag = insertTask(
                                owner.getId(),
                                sourceNoteId,
                                "HAS_SOURCE",
                                "Audio wrong tag",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME.plusMinutes(3));

                Long otherSource = insertTask(
                                owner.getId(),
                                otherSourceNoteId,
                                "HAS_SOURCE",
                                "Audio other source",
                                null,
                                "IN_PROGRESS",
                                LocalDate.of(2026, 8, 20),
                                BASE_TIME.plusMinutes(4));

                organizeTask(firstMatch, categoryId, tagId);
                organizeTask(secondMatch, categoryId, tagId);
                organizeTask(wrongCategory, otherCategoryId, tagId);
                organizeTask(wrongTag, categoryId, otherTagId);
                organizeTask(otherSource, categoryId, tagId);

                Cookie accessToken = login(owner.getEmail());

                JsonNode firstPage = getJson(
                                "/api/tasks?libraryAudioId=" + libraryAudioId
                                                + "&categoryId=" + categoryId
                                                + "&tagId=" + tagId
                                                + "&sourceStatus=HAS_SOURCE"
                                                + "&sortBy=createdAt"
                                                + "&sortDirection=asc"
                                                + "&page=0&size=1",
                                accessToken);

                assertThat(ids(firstPage)).containsExactly(firstMatch);
                assertThat(firstPage.get("totalElements").longValue()).isEqualTo(2);
                assertThat(firstPage.get("totalPages").intValue()).isEqualTo(2);

                JsonNode secondPage = getJson(
                                "/api/tasks?libraryAudioId=" + libraryAudioId
                                                + "&categoryId=" + categoryId
                                                + "&tagId=" + tagId
                                                + "&sourceStatus=HAS_SOURCE"
                                                + "&sortBy=createdAt"
                                                + "&sortDirection=asc"
                                                + "&page=1&size=1",
                                accessToken);

                assertThat(ids(secondPage)).containsExactly(secondMatch);

                for (Long inaccessibleId : new Long[] { 999999L, foreignLibraryAudioId }) {
                        mockMvc.perform(get("/api/tasks")
                                        .param("libraryAudioId", inaccessibleId.toString())
                                        .cookie(accessToken))
                                        .andExpect(status().isNotFound())
                                        .andExpect(jsonPath("$.code").value("LIBRARY_AUDIO_NOT_FOUND"));
                }
        }

        @Test
        void mediaLibraryFiltersAreMutuallyExclusive() throws Exception {
                Account owner = createAccount("task-media-filter-conflict@example.com");

                YouTubeVideo videoSource = createSource(
                                "task-media-filter-conflict-video",
                                YouTubeAvailabilityStatus.AVAILABLE);

                Long libraryVideoId = insertLibraryVideo(owner.getId(), videoSource.getId());

                Long imageSourceId = insertImageSource("task-media-filter-conflict-image");

                Long libraryImageId = insertLibraryImage(owner.getId(), imageSourceId);

                Long audioSourceId = insertAudioSource("task-media-filter-conflict-audio");

                Long libraryAudioId = insertLibraryAudio(owner.getId(), audioSourceId);

                Cookie accessToken = login(owner.getEmail());

                mockMvc.perform(get("/api/tasks")
                                .param("libraryVideoId", libraryVideoId.toString())
                                .param("libraryImageId", libraryImageId.toString())
                                .cookie(accessToken))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                                .andExpect(jsonPath("$.fieldErrors.libraryVideoId").exists())
                                .andExpect(jsonPath("$.fieldErrors.libraryImageId").exists());

                mockMvc.perform(get("/api/tasks")
                                .param("libraryVideoId", libraryVideoId.toString())
                                .param("libraryAudioId", libraryAudioId.toString())
                                .cookie(accessToken))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                                .andExpect(jsonPath("$.fieldErrors.libraryVideoId").exists())
                                .andExpect(jsonPath("$.fieldErrors.libraryAudioId").exists());

                mockMvc.perform(get("/api/tasks")
                                .param("libraryImageId", libraryImageId.toString())
                                .param("libraryAudioId", libraryAudioId.toString())
                                .cookie(accessToken))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                                .andExpect(jsonPath("$.fieldErrors.libraryImageId").exists())
                                .andExpect(jsonPath("$.fieldErrors.libraryAudioId").exists());

                mockMvc.perform(get("/api/tasks")
                                .param("libraryVideoId", libraryVideoId.toString())
                                .param("libraryImageId", libraryImageId.toString())
                                .param("libraryAudioId", libraryAudioId.toString())
                                .cookie(accessToken))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                                .andExpect(jsonPath("$.fieldErrors.libraryVideoId").exists())
                                .andExpect(jsonPath("$.fieldErrors.libraryImageId").exists())
                                .andExpect(jsonPath("$.fieldErrors.libraryAudioId").exists());
        }

        @Test
        void organizationSourceStatusExistingFiltersSortingAndPaginationCompose() throws Exception {
                Account owner = createAccount("task-v2-owner@example.com");
                Account other = createAccount("task-v2-other@example.com");
                YouTubeVideo source = createSource("task-v2-source", YouTubeAvailabilityStatus.AVAILABLE);
                Long sourceNoteId = insertNote(owner.getId(), source.getId(), "Source context");
                Long foreignNoteId = insertNote(other.getId(), source.getId(), "Private context");
                Long categoryId = insertCategory(owner.getId(), "Learning", "learning");
                Long otherCategoryId = insertCategory(owner.getId(), "Other", "other");
                Long foreignCategoryId = insertCategory(other.getId(), "Private", "private");
                Long alphaTagId = insertTag(owner.getId(), "Alpha", "alpha");
                Long betaTagId = insertTag(owner.getId(), "Beta", "beta");
                Long foreignTagId = insertTag(other.getId(), "Private", "private");

                Long firstIndependent = insertTask(
                                owner.getId(), null, "INDEPENDENT", "Project alpha", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME);
                Long secondIndependent = insertTask(
                                owner.getId(), null, "INDEPENDENT", "Review", "Project beta",
                                "IN_PROGRESS", LocalDate.of(2026, 8, 21), BASE_TIME);
                Long sourced = insertTask(
                                owner.getId(), sourceNoteId, "HAS_SOURCE", "Project sourced", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME.minusDays(1));
                Long missing = insertTask(
                                owner.getId(), null, "SOURCE_MISSING", "Project missing", null,
                                "NOT_STARTED", null, BASE_TIME.minusDays(2));
                Long wrongCategory = insertTask(
                                owner.getId(), null, "INDEPENDENT", "Project other", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME.plusDays(1));
                Long foreignTask = insertTask(
                                other.getId(), foreignNoteId, "HAS_SOURCE", "Project private", null,
                                "IN_PROGRESS", LocalDate.of(2026, 8, 20), BASE_TIME.plusDays(2));

                organizeTask(firstIndependent, categoryId, alphaTagId);
                organizeTask(secondIndependent, categoryId, betaTagId);
                organizeTask(sourced, categoryId, alphaTagId);
                organizeTask(missing, categoryId, betaTagId);
                organizeTask(wrongCategory, otherCategoryId, alphaTagId);
                organizeTask(foreignTask, foreignCategoryId, foreignTagId);
                jdbcTemplate.update("UPDATE tasks SET updated_at = ? WHERE id = ?",
                                BASE_TIME, firstIndependent);
                jdbcTemplate.update("UPDATE tasks SET updated_at = ? WHERE id = ?",
                                BASE_TIME.plusHours(1), secondIndependent);
                Cookie token = login(owner.getEmail());

                getTask(firstIndependent, token)
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.category.id").value(categoryId))
                                .andExpect(jsonPath("$.tags.length()").value(1))
                                .andExpect(jsonPath("$.tags[0].id").value(alphaTagId));

                JsonNode organizationFiltered = getJson(
                                "/api/tasks?categoryId=" + categoryId
                                                + "&tagId=" + alphaTagId
                                                + "&tagId=" + betaTagId,
                                token);
                assertThat(ids(organizationFiltered))
                                .containsExactly(secondIndependent, firstIndependent, sourced, missing);
                assertThat(organizationFiltered.get("items").get(0).get("category").get("id").longValue())
                                .isEqualTo(categoryId);
                assertThat(organizationFiltered.get("items").get(0).get("tags").isArray()).isTrue();

                assertThat(ids(getJson("/api/tasks?sourceStatus=INDEPENDENT", token)))
                                .containsExactly(wrongCategory, secondIndependent, firstIndependent);
                assertThat(ids(getJson("/api/tasks?sourceStatus=HAS_SOURCE", token)))
                                .containsExactly(sourced);
                assertThat(ids(getJson("/api/tasks?sourceStatus=SOURCE_MISSING", token)))
                                .containsExactly(missing);

                JsonNode composed = getJson(
                                "/api/tasks?q=project&status=IN_PROGRESS"
                                                + "&deadlineFrom=2026-08-20&deadlineTo=2026-08-21"
                                                + "&categoryId=" + categoryId
                                                + "&tagId=" + alphaTagId
                                                + "&tagId=" + betaTagId
                                                + "&sourceStatus=INDEPENDENT",
                                token);
                assertThat(ids(composed)).containsExactly(secondIndependent, firstIndependent);

                assertThat(ids(getJson(
                                "/api/tasks?categoryId=" + categoryId
                                                + "&sourceStatus=INDEPENDENT&sortBy=createdAt&sortDirection=asc",
                                token))).containsExactly(firstIndependent, secondIndependent);
                assertThat(ids(getJson(
                                "/api/tasks?categoryId=" + categoryId
                                                + "&sourceStatus=INDEPENDENT&sortBy=createdAt&sortDirection=desc",
                                token))).containsExactly(secondIndependent, firstIndependent);
                assertThat(ids(getJson(
                                "/api/tasks?categoryId=" + categoryId
                                                + "&sourceStatus=INDEPENDENT&sortBy=updatedAt&sortDirection=desc",
                                token))).containsExactly(secondIndependent, firstIndependent);
                assertThat(ids(getJson(
                                "/api/tasks?categoryId=" + categoryId
                                                + "&sourceStatus=INDEPENDENT&sortBy=deadline&sortDirection=asc",
                                token))).containsExactly(firstIndependent, secondIndependent);
                assertThat(ids(getJson(
                                "/api/tasks?categoryId=" + categoryId
                                                + "&sourceStatus=INDEPENDENT&sortBy=deadline&sortDirection=desc",
                                token))).containsExactly(secondIndependent, firstIndependent);

                JsonNode firstPage = getJson(
                                "/api/tasks?categoryId=" + categoryId
                                                + "&sourceStatus=INDEPENDENT&sortBy=createdAt&sortDirection=asc&page=0&size=1",
                                token);
                JsonNode secondPage = getJson(
                                "/api/tasks?categoryId=" + categoryId
                                                + "&sourceStatus=INDEPENDENT&sortBy=createdAt&sortDirection=asc&page=1&size=1",
                                token);
                assertThat(ids(firstPage)).containsExactly(firstIndependent);
                assertThat(ids(secondPage)).containsExactly(secondIndependent);
                assertThat(firstPage.get("totalElements").longValue()).isEqualTo(2);
                assertThat(firstPage.get("totalPages").intValue()).isEqualTo(2);
        }

        @Test
        void organizationFiltersAreOwnershipSafeAndNewEnumsAndSortsAreValidated() throws Exception {
                Account owner = createAccount("task-v2-validation-owner@example.com");
                Account other = createAccount("task-v2-validation-other@example.com");
                Long foreignCategoryId = insertCategory(other.getId(), "Private", "private");
                Long foreignTagId = insertTag(other.getId(), "Private", "private");
                Cookie token = login(owner.getEmail());

                mockMvc.perform(get("/api/tasks")
                                .param("categoryId", foreignCategoryId.toString())
                                .cookie(token))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.code").value("CATEGORY_NOT_FOUND"));
                mockMvc.perform(get("/api/tasks")
                                .param("tagId", foreignTagId.toString())
                                .cookie(token))
                                .andExpect(status().isNotFound())
                                .andExpect(jsonPath("$.code").value("TAG_NOT_FOUND"));

                for (String[] invalid : new String[][] {
                                { "sourceStatus", "AVAILABLE", "sourceStatus" },
                                { "sortBy", "status", "sortBy" },
                                { "sortDirection", "up", "sortDirection" } }) {
                        mockMvc.perform(get("/api/tasks")
                                        .param(invalid[0], invalid[1])
                                        .cookie(token))
                                        .andExpect(status().isBadRequest())
                                        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                                        .andExpect(jsonPath("$.fieldErrors." + invalid[2]).exists());
                }
        }

        @Test
        void detailIsOwnershipSafeAndSupportsEverySourceLifecycleState() throws Exception {
                Account owner = createAccount("task-detail-owner@example.com");
                Account other = createAccount("task-detail-other@example.com");
                YouTubeVideo source = createSource("task-detail-source", YouTubeAvailabilityStatus.UNAVAILABLE);
                Long sourceNoteId = insertNote(owner.getId(), source.getId(), "Owned source");
                Long independentId = insertTask(owner.getId(), null, "INDEPENDENT", "Independent", null,
                                "NOT_STARTED", null, BASE_TIME);
                Long sourcedId = insertTask(owner.getId(), sourceNoteId, "HAS_SOURCE", "Sourced", null,
                                "IN_PROGRESS", null, BASE_TIME);
                Long missingId = insertTask(owner.getId(), null, "SOURCE_MISSING", "Missing", null,
                                "COMPLETED", null, BASE_TIME);
                Long deletedSourceNoteId = insertNote(owner.getId(), source.getId(), "Delete me");
                Long deletedSourceTaskId = insertTask(owner.getId(), deletedSourceNoteId, "HAS_SOURCE",
                                "Retained task", null, "NOT_STARTED", null, BASE_TIME);
                jdbcTemplate.update("""
                                UPDATE tasks
                                SET source_note_id = NULL, source_status = 'SOURCE_MISSING', updated_at = ?
                                WHERE id = ?
                                """, BASE_TIME.plusMinutes(1), deletedSourceTaskId);
                jdbcTemplate.update("DELETE FROM notes WHERE id = ?", deletedSourceNoteId);
                Long foreignId = insertTask(other.getId(), null, "INDEPENDENT", "Foreign", null,
                                "NOT_STARTED", null, BASE_TIME);
                Cookie accessToken = login(owner.getEmail());

                getTask(independentId, accessToken)
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.sourceStatus").value("INDEPENDENT"))
                                .andExpect(jsonPath("$.sourceNoteId").doesNotExist());
                getTask(sourcedId, accessToken)
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.sourceStatus").value("HAS_SOURCE"))
                                .andExpect(jsonPath("$.sourceNoteId").value(sourceNoteId));
                getTask(missingId, accessToken)
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.sourceStatus").value("SOURCE_MISSING"))
                                .andExpect(jsonPath("$.sourceNoteId").doesNotExist());
                getTask(deletedSourceTaskId, accessToken)
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.sourceStatus").value("SOURCE_MISSING"))
                                .andExpect(jsonPath("$.sourceNoteId").doesNotExist());

                for (Long taskId : new Long[] { 999999L, foreignId }) {
                        getTask(taskId, accessToken)
                                        .andExpect(status().isNotFound())
                                        .andExpect(jsonPath("$.code").value("TASK_NOT_FOUND"));
                }
        }

        @Test
        void readOperationsDoNotMutateDataOrCallYouTube() throws Exception {
                Account owner = createAccount("task-readonly@example.com");
                YouTubeVideo source = createSource("task-readonly-source", YouTubeAvailabilityStatus.AVAILABLE);
                Long noteId = insertNote(owner.getId(), source.getId(), "Context");
                Long taskId = insertTask(owner.getId(), noteId, "HAS_SOURCE", "Searchable task", "Description",
                                "NOT_STARTED", LocalDate.of(2026, 8, 20), BASE_TIME);
                Cookie accessToken = login(owner.getEmail());
                Map<String, Object> taskBefore = jdbcTemplate.queryForMap("SELECT * FROM tasks WHERE id = ?", taskId);
                Map<String, Object> noteBefore = jdbcTemplate.queryForMap("SELECT * FROM notes WHERE id = ?", noteId);
                Map<String, Object> sourceBefore = jdbcTemplate.queryForMap(
                                "SELECT * FROM youtube_videos WHERE id = ?", source.getId());

                getJson("/api/tasks?q=search&status=NOT_STARTED&deadlineFrom=2026-08-20", accessToken);
                getTask(taskId, accessToken).andExpect(status().isOk());

                assertThat(jdbcTemplate.queryForMap("SELECT * FROM tasks WHERE id = ?", taskId))
                                .isEqualTo(taskBefore);
                assertThat(jdbcTemplate.queryForMap("SELECT * FROM notes WHERE id = ?", noteId))
                                .isEqualTo(noteBefore);
                assertThat(jdbcTemplate.queryForMap("SELECT * FROM youtube_videos WHERE id = ?", source.getId()))
                                .isEqualTo(sourceBefore);
                assertThat(count("library_videos")).isZero();
                assertThat(count("watch_sessions")).isZero();
                assertThat(count("tags")).isZero();
                verifyNoInteractions(youTubeMetadataClient);
        }

        private Account createAccount(String email) {
                return accountRepository.saveAndFlush(Account.create(
                                email,
                                passwordEncoder.encode(PASSWORD),
                                "Test User",
                                BASE_TIME));
        }

        private YouTubeVideo createSource(String youtubeVideoId, YouTubeAvailabilityStatus availability) {
                return youTubeVideoRepository.saveAndFlush(YouTubeVideo.create(
                                youtubeVideoId,
                                "https://www.youtube.com/watch?v=" + youtubeVideoId,
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

        private Long insertImageSource(String id) {
                return jdbcTemplate.queryForObject("""
                                INSERT INTO image_sources (
                                        origin,
                                        external_url,
                                        storage_key,
                                        original_filename,
                                        media_type,
                                        size_bytes,
                                        created_at
                                ) VALUES (
                                        'EXTERNAL',
                                        ?,
                                        NULL,
                                        NULL,
                                        NULL,
                                        NULL,
                                        ?
                                )
                                RETURNING id
                                """,
                                Long.class,
                                "https://image.example/" + id + ".jpg",
                                BASE_TIME);
        }

        private Long insertLibraryImage(Long accountId, Long imageSourceId) {
                return jdbcTemplate.queryForObject("""
                                INSERT INTO library_images (
                                        account_id,
                                        image_source_id,
                                        added_at
                                ) VALUES (?, ?, ?)
                                RETURNING id
                                """,
                                Long.class,
                                accountId,
                                imageSourceId,
                                BASE_TIME);
        }

        private Long insertImageNote(
                        Long accountId,
                        Long imageSourceId,
                        String content) {

                return jdbcTemplate.queryForObject("""
                                INSERT INTO notes (
                                        account_id,
                                        source_type,
                                        youtube_source_id,
                                        image_source_id,
                                        audio_source_id,
                                        content,
                                        timestamp_seconds,
                                        created_at,
                                        updated_at
                                ) VALUES (
                                        ?,
                                        'IMAGE',
                                        NULL,
                                        ?,
                                        NULL,
                                        ?,
                                        NULL,
                                        ?,
                                        ?
                                )
                                RETURNING id
                                """,
                                Long.class,
                                accountId,
                                imageSourceId,
                                content,
                                BASE_TIME,
                                BASE_TIME);
        }

        private Long insertAudioSource(String id) {
                return jdbcTemplate.queryForObject("""
                                INSERT INTO audio_sources (
                                        origin,
                                        external_url,
                                        storage_key,
                                        original_filename,
                                        media_type,
                                        size_bytes,
                                        created_at
                                ) VALUES (
                                        'EXTERNAL',
                                        ?,
                                        NULL,
                                        NULL,
                                        NULL,
                                        NULL,
                                        ?
                                )
                                RETURNING id
                                """,
                                Long.class,
                                "https://audio.example/" + id + ".mp3",
                                BASE_TIME);
        }

        private Long insertLibraryAudio(Long accountId, Long audioSourceId) {
                return jdbcTemplate.queryForObject("""
                                INSERT INTO library_audio (
                                        account_id,
                                        audio_source_id,
                                        title,
                                        added_at
                                ) VALUES (?, ?, NULL, ?)
                                RETURNING id
                                """,
                                Long.class,
                                accountId,
                                audioSourceId,
                                BASE_TIME);
        }

        private Long insertAudioNote(
                        Long accountId,
                        Long audioSourceId,
                        String content) {

                return jdbcTemplate.queryForObject("""
                                INSERT INTO notes (
                                        account_id,
                                        source_type,
                                        youtube_source_id,
                                        image_source_id,
                                        audio_source_id,
                                        content,
                                        timestamp_seconds,
                                        created_at,
                                        updated_at
                                ) VALUES (
                                        ?,
                                        'AUDIO',
                                        NULL,
                                        NULL,
                                        ?,
                                        ?,
                                        NULL,
                                        ?,
                                        ?
                                )
                                RETURNING id
                                """,
                                Long.class,
                                accountId,
                                audioSourceId,
                                content,
                                BASE_TIME,
                                BASE_TIME);
        }

        private Long insertLibraryVideo(Long accountId, Long sourceId) {
                return jdbcTemplate.queryForObject(
                                """
                                                INSERT INTO library_videos (
                                                    account_id, youtube_source_id, custom_title, personal_description, added_at, updated_at
                                                ) VALUES (?, ?, NULL, NULL, ?, ?)
                                                RETURNING id
                                                """,
                                Long.class, accountId, sourceId, BASE_TIME, BASE_TIME);
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

        private void organizeTask(Long taskId, Long categoryId, Long tagId) {
                jdbcTemplate.update("UPDATE tasks SET category_id = ? WHERE id = ?", categoryId, taskId);
                jdbcTemplate.update("INSERT INTO task_tags (task_id, tag_id) VALUES (?, ?)", taskId, tagId);
        }

        private org.springframework.test.web.servlet.ResultActions getTask(Long taskId, Cookie accessToken)
                        throws Exception {
                return mockMvc.perform(get("/api/tasks/{taskId}", taskId).cookie(accessToken));
        }

        private JsonNode getJson(String path, Cookie accessToken) throws Exception {
                MvcResult result = mockMvc.perform(get(path).cookie(accessToken))
                                .andExpect(status().isOk())
                                .andReturn();
                return objectMapper.readTree(result.getResponse().getContentAsByteArray());
        }

        private JsonNode getJsonWithQuery(String query, Cookie accessToken) throws Exception {
                MvcResult result = mockMvc.perform(get("/api/tasks").param("q", query).cookie(accessToken))
                                .andExpect(status().isOk())
                                .andReturn();
                return objectMapper.readTree(result.getResponse().getContentAsByteArray());
        }

        private List<Long> ids(JsonNode page) {
                return page.get("items").valueStream()
                                .map(item -> item.get("id").longValue())
                                .toList();
        }

        private long count(String table) {
                return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
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

        private record CsrfExchange(Cookie cookie, String token, String headerName) {
        }
}
