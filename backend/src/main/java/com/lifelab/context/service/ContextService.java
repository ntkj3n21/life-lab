package com.lifelab.context.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.context.domain.ContextNavigationMode;
import com.lifelab.context.dto.ContextResponse;
import com.lifelab.note.domain.Note;
import com.lifelab.note.domain.NoteSourceType;
import com.lifelab.note.dto.NoteResponse;
import com.lifelab.note.exception.NoteNotFoundException;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.organization.service.ItemOrganizationService;
import com.lifelab.source.audio.domain.LibraryAudio;
import com.lifelab.source.audio.repository.LibraryAudioRepository;
import com.lifelab.source.image.domain.LibraryImage;
import com.lifelab.source.image.repository.LibraryImageRepository;
import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskSourceStatus;
import com.lifelab.task.dto.TaskResponse;
import com.lifelab.task.exception.TaskNotFoundException;
import com.lifelab.task.repository.TaskRepository;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
import com.lifelab.video.integration.youtube.YouTubeVideoNotFoundException;

import com.lifelab.video.repository.LibraryVideoRepository;

@Service
public class ContextService {

    private final NoteRepository noteRepository;
    private final TaskRepository taskRepository;
    private final LibraryVideoRepository libraryVideoRepository;
    private final LibraryImageRepository libraryImageRepository;
    private final LibraryAudioRepository libraryAudioRepository;
    private final YouTubeMetadataClient youTubeMetadataClient;
    private final ItemOrganizationService organizationService;

    public ContextService(
            NoteRepository noteRepository,
            TaskRepository taskRepository,
            LibraryVideoRepository libraryVideoRepository,
            LibraryImageRepository libraryImageRepository,
            LibraryAudioRepository libraryAudioRepository,
            YouTubeMetadataClient youTubeMetadataClient,
            ItemOrganizationService organizationService) {
        this.noteRepository = noteRepository;
        this.taskRepository = taskRepository;
        this.libraryVideoRepository = libraryVideoRepository;
        this.libraryImageRepository = libraryImageRepository;
        this.libraryAudioRepository = libraryAudioRepository;
        this.youTubeMetadataClient = youTubeMetadataClient;
        this.organizationService = organizationService;
    }

    @Transactional(readOnly = true)
    public ContextResponse resolveFromNote(Long accountId, Long noteId) {
        Note note = noteRepository.findByIdAndAccount_Id(noteId, accountId)
                .orElseThrow(NoteNotFoundException::new);

        return resolveNoteContext(accountId, null, note);
    }

    @Transactional(readOnly = true)
    public ContextResponse resolveFromTask(Long accountId, Long taskId) {
        Task task = taskRepository.findByIdAndAccount_Id(taskId, accountId)
                .orElseThrow(TaskNotFoundException::new);

        TaskResponse taskResponse = organizationService.toTaskResponse(task);

        if (task.getSourceStatus() == TaskSourceStatus.INDEPENDENT) {
            return new ContextResponse(
                    ContextNavigationMode.NO_SOURCE,
                    taskResponse,
                    null,
                    null,
                    null,
                    null);
        }

        if (task.getSourceStatus() == TaskSourceStatus.SOURCE_MISSING
                || task.getSourceNote() == null) {
            return new ContextResponse(
                    ContextNavigationMode.SOURCE_MISSING,
                    taskResponse,
                    null,
                    null,
                    null,
                    null);
        }

        Long sourceNoteId = task.getSourceNote().getId();

        Note sourceNote = noteRepository.findByIdAndAccount_Id(
                        sourceNoteId,
                        accountId)
                .orElse(null);

        if (sourceNote == null) {
            return new ContextResponse(
                    ContextNavigationMode.SOURCE_MISSING,
                    taskResponse,
                    null,
                    null,
                    null,
                    null);
        }

        return resolveNoteContext(
                accountId,
                taskResponse,
                sourceNote);
    }

    private ContextResponse resolveNoteContext(
            Long accountId,
            TaskResponse task,
            Note note) {

        NoteResponse noteResponse = organizationService.toNoteResponse(note);

        if (note.getSourceType() == NoteSourceType.IMAGE) {
            return resolveImageContext(accountId, task, note, noteResponse);
        }

        if (note.getSourceType() == NoteSourceType.AUDIO) {
            return resolveAudioContext(accountId, task, note, noteResponse);
        }

        if (note.getYoutubeSource().getAvailabilityStatus()
                == YouTubeAvailabilityStatus.UNAVAILABLE) {
            return videoUnavailable(task, noteResponse);
        }

        try {
            youTubeMetadataClient.resolve(
                    note.getYoutubeSource().getYoutubeVideoId());
        } catch (YouTubeVideoNotFoundException exception) {
            return videoUnavailable(task, noteResponse);
        }

        LibraryVideo libraryVideo =
                libraryVideoRepository
                        .findByAccount_IdAndYoutubeSource_Id(
                                accountId,
                                note.getYoutubeSource().getId())
                        .orElse(null);

        if (libraryVideo != null) {
            return new ContextResponse(
                    ContextNavigationMode.WORKSPACE,
                    task,
                    noteResponse,
                    libraryVideo.getId(),
                    null,
                    null);
        }

        return new ContextResponse(
                ContextNavigationMode.SOURCE_PREVIEW,
                task,
                noteResponse,
                null,
                null,
                null);
    }

    private ContextResponse resolveImageContext(
            Long accountId,
            TaskResponse task,
            Note note,
            NoteResponse noteResponse) {
        LibraryImage image = libraryImageRepository
                .findByAccount_IdAndImageSource_Id(
                        accountId,
                        note.getImageSource().getId())
                .orElse(null);
        return new ContextResponse(
                image == null
                        ? ContextNavigationMode.SOURCE_PREVIEW
                        : ContextNavigationMode.WORKSPACE,
                task,
                noteResponse,
                null,
                image == null ? null : image.getId(),
                null);
    }

    private ContextResponse resolveAudioContext(
            Long accountId,
            TaskResponse task,
            Note note,
            NoteResponse noteResponse) {
        LibraryAudio audio = libraryAudioRepository
                .findByAccount_IdAndAudioSource_Id(
                        accountId,
                        note.getAudioSource().getId())
                .orElse(null);
        return new ContextResponse(
                audio == null
                        ? ContextNavigationMode.SOURCE_PREVIEW
                        : ContextNavigationMode.WORKSPACE,
                task,
                noteResponse,
                null,
                null,
                audio == null ? null : audio.getId());
    }

    private ContextResponse videoUnavailable(
            TaskResponse task,
            NoteResponse note) {

        return new ContextResponse(
                ContextNavigationMode.VIDEO_UNAVAILABLE,
                task,
                note,
                null,
                null,
                null);
    }
}
