package com.lifelab.context.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.lifelab.auth.domain.Account;
import com.lifelab.context.domain.ContextNavigationMode;
import com.lifelab.context.dto.ContextResponse;
import com.lifelab.note.domain.Note;
import com.lifelab.note.exception.NoteNotFoundException;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskSourceStatus;
import com.lifelab.task.exception.TaskNotFoundException;
import com.lifelab.task.repository.TaskRepository;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
import com.lifelab.video.integration.youtube.YouTubeServiceException;
import com.lifelab.video.integration.youtube.YouTubeVideoNotFoundException;
import com.lifelab.video.repository.LibraryVideoRepository;

class ContextServiceTest {

    private static final Long ACCOUNT_ID = 7L;
    private static final Long NOTE_ID = 11L;
    private static final Long TASK_ID = 21L;

    private static final OffsetDateTime NOW =
            OffsetDateTime.parse("2026-08-12T00:00:00Z");

    private final YouTubeMetadataClient youTubeMetadataClient =
            mock(YouTubeMetadataClient.class);

    @Test
    void noteWithAvailableSourceInLibraryResolvesWorkspace() {
        NoteRepository noteRepository = mock(NoteRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        LibraryVideoRepository libraryVideoRepository =
                mock(LibraryVideoRepository.class);

        YouTubeVideo source =
                source(YouTubeAvailabilityStatus.AVAILABLE);

        Note note = note(source, 125);

        LibraryVideo libraryVideo = mock(LibraryVideo.class);
        when(libraryVideo.getId()).thenReturn(31L);

        when(noteRepository.findByIdAndAccount_Id(
                NOTE_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.of(note));

        when(libraryVideoRepository
                .findByAccount_IdAndYoutubeSource_Id(
                        ACCOUNT_ID,
                        source.getId()))
                .thenReturn(Optional.of(libraryVideo));

        ContextService service = new ContextService(
                noteRepository,
                taskRepository,
                libraryVideoRepository,
                youTubeMetadataClient);

        ContextResponse response =
                service.resolveFromNote(ACCOUNT_ID, NOTE_ID);

        assertThat(response.navigationMode())
                .isEqualTo(ContextNavigationMode.WORKSPACE);

        assertThat(response.task()).isNull();
        assertThat(response.note()).isNotNull();
        assertThat(response.note().timestampSeconds())
                .isEqualTo(125);
        assertThat(response.note().youtubeSource().sourceUrl())
                .isEqualTo(source.getSourceUrl());

        assertThat(response.libraryVideoId()).isEqualTo(31L);

        verify(youTubeMetadataClient)
                .resolve(source.getYoutubeVideoId());

        verifyNoInteractions(taskRepository);
    }

    @Test
    void noteWithoutLibraryVideoResolvesSourcePreview() {
        NoteRepository noteRepository = mock(NoteRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        LibraryVideoRepository libraryVideoRepository =
                mock(LibraryVideoRepository.class);

        YouTubeVideo source =
                source(YouTubeAvailabilityStatus.AVAILABLE);

        Note note = note(source, null);

        when(noteRepository.findByIdAndAccount_Id(
                NOTE_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.of(note));

        when(libraryVideoRepository
                .findByAccount_IdAndYoutubeSource_Id(
                        ACCOUNT_ID,
                        source.getId()))
                .thenReturn(Optional.empty());

        ContextService service = new ContextService(
                noteRepository,
                taskRepository,
                libraryVideoRepository,
                youTubeMetadataClient);

        ContextResponse response =
                service.resolveFromNote(ACCOUNT_ID, NOTE_ID);

        assertThat(response.navigationMode())
                .isEqualTo(ContextNavigationMode.SOURCE_PREVIEW);

        assertThat(response.task()).isNull();
        assertThat(response.note()).isNotNull();

        assertThat(response.note().timestampSeconds()).isNull();

        assertThat(response.note().youtubeSource().sourceUrl())
                .isEqualTo(source.getSourceUrl());

        assertThat(response.libraryVideoId()).isNull();

        verify(youTubeMetadataClient)
                .resolve(source.getYoutubeVideoId());

        verifyNoInteractions(taskRepository);
    }

    @Test
    void unavailableYoutubeSourceResolvesVideoUnavailableBeforeLibraryLookup() {
        NoteRepository noteRepository = mock(NoteRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        LibraryVideoRepository libraryVideoRepository =
                mock(LibraryVideoRepository.class);

        YouTubeVideo source =
                source(YouTubeAvailabilityStatus.UNAVAILABLE);

        Note note = note(source, 42);

        when(noteRepository.findByIdAndAccount_Id(
                NOTE_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.of(note));

        ContextService service = new ContextService(
                noteRepository,
                taskRepository,
                libraryVideoRepository,
                youTubeMetadataClient);

        ContextResponse response =
                service.resolveFromNote(ACCOUNT_ID, NOTE_ID);

        assertThat(response.navigationMode())
                .isEqualTo(
                        ContextNavigationMode.VIDEO_UNAVAILABLE);

        assertThat(response.task()).isNull();
        assertThat(response.note()).isNotNull();

        assertThat(
                response.note()
                        .youtubeSource()
                        .availabilityStatus())
                .isEqualTo(
                        YouTubeAvailabilityStatus.UNAVAILABLE);

        assertThat(response.note().timestampSeconds())
                .isEqualTo(42);

        assertThat(response.libraryVideoId()).isNull();

        verifyNoInteractions(taskRepository);
        verifyNoInteractions(libraryVideoRepository);
        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void independentTaskResolvesNoSourceWithoutInventingContext() {
        NoteRepository noteRepository = mock(NoteRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        LibraryVideoRepository libraryVideoRepository =
                mock(LibraryVideoRepository.class);

        Task task = mock(Task.class);

        when(task.getId()).thenReturn(TASK_ID);
        when(task.getTitle()).thenReturn("Independent task");
        when(task.getSourceStatus())
                .thenReturn(TaskSourceStatus.INDEPENDENT);

        when(taskRepository.findByIdAndAccount_Id(
                TASK_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.of(task));

        ContextService service = new ContextService(
                noteRepository,
                taskRepository,
                libraryVideoRepository,
                youTubeMetadataClient);

        ContextResponse response =
                service.resolveFromTask(ACCOUNT_ID, TASK_ID);

        assertThat(response.navigationMode())
                .isEqualTo(ContextNavigationMode.NO_SOURCE);

        assertThat(response.task()).isNotNull();
        assertThat(response.task().id()).isEqualTo(TASK_ID);
        assertThat(response.task().sourceStatus())
                .isEqualTo(TaskSourceStatus.INDEPENDENT);

        assertThat(response.note()).isNull();
        assertThat(response.libraryVideoId()).isNull();

        verifyNoInteractions(noteRepository);
        verifyNoInteractions(libraryVideoRepository);
        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void taskWhoseRecordedNoteWasDeletedResolvesSourceMissing() {
        NoteRepository noteRepository = mock(NoteRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        LibraryVideoRepository libraryVideoRepository =
                mock(LibraryVideoRepository.class);

        Task task = mock(Task.class);

        when(task.getId()).thenReturn(TASK_ID);
        when(task.getTitle()).thenReturn("Missing source task");
        when(task.getSourceStatus())
                .thenReturn(TaskSourceStatus.SOURCE_MISSING);
        when(task.getSourceNote()).thenReturn(null);

        when(taskRepository.findByIdAndAccount_Id(
                TASK_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.of(task));

        ContextService service = new ContextService(
                noteRepository,
                taskRepository,
                libraryVideoRepository,
                youTubeMetadataClient);

        ContextResponse response =
                service.resolveFromTask(ACCOUNT_ID, TASK_ID);

        assertThat(response.navigationMode())
                .isEqualTo(
                        ContextNavigationMode.SOURCE_MISSING);

        assertThat(response.task()).isNotNull();
        assertThat(response.task().id()).isEqualTo(TASK_ID);
        assertThat(response.task().sourceStatus())
                .isEqualTo(TaskSourceStatus.SOURCE_MISSING);

        assertThat(response.note()).isNull();
        assertThat(response.libraryVideoId()).isNull();

        verifyNoInteractions(noteRepository);
        verifyNoInteractions(libraryVideoRepository);
        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void sourcedTaskFollowsExactRecordedNoteThenSourcePreview() {
        NoteRepository noteRepository = mock(NoteRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        LibraryVideoRepository libraryVideoRepository =
                mock(LibraryVideoRepository.class);

        YouTubeVideo source =
                source(YouTubeAvailabilityStatus.AVAILABLE);

        Note sourceNote = mock(Note.class);

        when(sourceNote.getId()).thenReturn(NOTE_ID);
        when(sourceNote.getYoutubeSource()).thenReturn(source);
        when(sourceNote.getContent()).thenReturn("Exact source note");
        when(sourceNote.getTimestampSeconds()).thenReturn(73);
        when(sourceNote.getCreatedAt()).thenReturn(NOW);
        when(sourceNote.getUpdatedAt()).thenReturn(NOW);

        Task task = mock(Task.class);

        when(task.getId()).thenReturn(TASK_ID);
        when(task.getTitle()).thenReturn("Sourced task");
        when(task.getSourceStatus())
                .thenReturn(TaskSourceStatus.HAS_SOURCE);
        when(task.getSourceNote()).thenReturn(sourceNote);

        when(taskRepository.findByIdAndAccount_Id(
                TASK_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.of(task));

        when(noteRepository.findByIdAndAccount_Id(
                NOTE_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.of(sourceNote));

        when(libraryVideoRepository
                .findByAccount_IdAndYoutubeSource_Id(
                        ACCOUNT_ID,
                        source.getId()))
                .thenReturn(Optional.empty());

        ContextService service = new ContextService(
                noteRepository,
                taskRepository,
                libraryVideoRepository,
                youTubeMetadataClient);

        ContextResponse response =
                service.resolveFromTask(ACCOUNT_ID, TASK_ID);

        assertThat(response.navigationMode())
                .isEqualTo(
                        ContextNavigationMode.SOURCE_PREVIEW);

        assertThat(response.task()).isNotNull();
        assertThat(response.task().id()).isEqualTo(TASK_ID);

        assertThat(response.note()).isNotNull();
        assertThat(response.note().id()).isEqualTo(NOTE_ID);
        assertThat(response.note().content())
                .isEqualTo("Exact source note");
        assertThat(response.note().timestampSeconds())
                .isEqualTo(73);

        assertThat(response.libraryVideoId()).isNull();

        verify(noteRepository)
                .findByIdAndAccount_Id(
                        NOTE_ID,
                        ACCOUNT_ID);

        verify(youTubeMetadataClient)
                .resolve(source.getYoutubeVideoId());
    }

    @Test
    void unknownOrForeignResourcesRemainOwnershipSafeNotFound() {
        NoteRepository noteRepository = mock(NoteRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        LibraryVideoRepository libraryVideoRepository =
                mock(LibraryVideoRepository.class);

        when(noteRepository.findByIdAndAccount_Id(
                NOTE_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.empty());

        when(taskRepository.findByIdAndAccount_Id(
                TASK_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.empty());

        ContextService service = new ContextService(
                noteRepository,
                taskRepository,
                libraryVideoRepository,
                youTubeMetadataClient);

        assertThatThrownBy(() ->
                service.resolveFromNote(
                        ACCOUNT_ID,
                        NOTE_ID))
                .isInstanceOf(NoteNotFoundException.class);

        assertThatThrownBy(() ->
                service.resolveFromTask(
                        ACCOUNT_ID,
                        TASK_ID))
                .isInstanceOf(TaskNotFoundException.class);

        verify(libraryVideoRepository, never())
                .findByAccount_IdAndYoutubeSource_Id(
                        org.mockito.ArgumentMatchers.anyLong(),
                        org.mockito.ArgumentMatchers.anyLong());

        verifyNoInteractions(youTubeMetadataClient);
    }

    @Test
    void storedAvailableSourceThatYoutubeNoLongerFindsResolvesVideoUnavailable() {
        NoteRepository noteRepository = mock(NoteRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        LibraryVideoRepository libraryVideoRepository =
                mock(LibraryVideoRepository.class);

        YouTubeVideo source =
                source(YouTubeAvailabilityStatus.AVAILABLE);

        Note note = note(source, 88);

        when(noteRepository.findByIdAndAccount_Id(
                NOTE_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.of(note));

        when(youTubeMetadataClient.resolve(
                source.getYoutubeVideoId()))
                .thenThrow(new YouTubeVideoNotFoundException());

        ContextService service = new ContextService(
                noteRepository,
                taskRepository,
                libraryVideoRepository,
                youTubeMetadataClient);

        ContextResponse response =
                service.resolveFromNote(ACCOUNT_ID, NOTE_ID);

        assertThat(response.navigationMode())
                .isEqualTo(
                        ContextNavigationMode.VIDEO_UNAVAILABLE);

        assertThat(response.task()).isNull();
        assertThat(response.note()).isNotNull();
        assertThat(response.note().timestampSeconds())
                .isEqualTo(88);
        assertThat(response.note().youtubeSource().youtubeVideoId())
                .isEqualTo(source.getYoutubeVideoId());

        assertThat(response.libraryVideoId()).isNull();

        verify(youTubeMetadataClient)
                .resolve(source.getYoutubeVideoId());

        verifyNoInteractions(taskRepository);
        verifyNoInteractions(libraryVideoRepository);
    }

    @Test
    void youtubeServiceFailureIsNotMisclassifiedAsVideoUnavailable() {
        NoteRepository noteRepository = mock(NoteRepository.class);
        TaskRepository taskRepository = mock(TaskRepository.class);
        LibraryVideoRepository libraryVideoRepository =
                mock(LibraryVideoRepository.class);

        YouTubeVideo source =
                source(YouTubeAvailabilityStatus.AVAILABLE);

        Note note = note(source, 33);

        when(noteRepository.findByIdAndAccount_Id(
                NOTE_ID,
                ACCOUNT_ID))
                .thenReturn(Optional.of(note));

        when(youTubeMetadataClient.resolve(
                source.getYoutubeVideoId()))
                .thenThrow(
                        new YouTubeServiceException(
                                "Temporary YouTube failure"));

        ContextService service = new ContextService(
                noteRepository,
                taskRepository,
                libraryVideoRepository,
                youTubeMetadataClient);

        assertThatThrownBy(() ->
                service.resolveFromNote(
                        ACCOUNT_ID,
                        NOTE_ID))
                .isInstanceOf(YouTubeServiceException.class);

        verify(youTubeMetadataClient)
                .resolve(source.getYoutubeVideoId());

        verifyNoInteractions(taskRepository);
        verifyNoInteractions(libraryVideoRepository);
    }

    private Note note(
            YouTubeVideo source,
            Integer timestampSeconds) {

        return Note.create(
                account(),
                source,
                "Context note",
                timestampSeconds,
                NOW);
    }

    private Account account() {
        return Account.create(
                "context@example.com",
                "hash",
                "Context User",
                NOW);
    }

    private YouTubeVideo source(
            YouTubeAvailabilityStatus availabilityStatus) {

        return YouTubeVideo.create(
                "context-video",
                "https://www.youtube.com/watch?v=context-video",
                "Context Video",
                "Context Channel",
                "https://image.example/context-video.jpg",
                300,
                NOW.minusDays(10),
                availabilityStatus,
                NOW);
    }
}