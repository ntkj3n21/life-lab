package com.lifelab.context.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.context.domain.ContextNavigationMode;
import com.lifelab.context.dto.ContextResponse;
import com.lifelab.note.domain.Note;
import com.lifelab.note.dto.NoteResponse;
import com.lifelab.note.exception.NoteNotFoundException;
import com.lifelab.note.repository.NoteRepository;
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
    private final YouTubeMetadataClient youTubeMetadataClient;

    public ContextService(
            NoteRepository noteRepository,
            TaskRepository taskRepository,
            LibraryVideoRepository libraryVideoRepository,
            YouTubeMetadataClient youTubeMetadataClient) {
        this.noteRepository = noteRepository;
        this.taskRepository = taskRepository;
        this.libraryVideoRepository = libraryVideoRepository;
        this.youTubeMetadataClient = youTubeMetadataClient;
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

        TaskResponse taskResponse = TaskResponse.from(task);

        if (task.getSourceStatus() == TaskSourceStatus.INDEPENDENT) {
            return new ContextResponse(
                    ContextNavigationMode.NO_SOURCE,
                    taskResponse,
                    null,
                    null);
        }

        if (task.getSourceStatus() == TaskSourceStatus.SOURCE_MISSING
                || task.getSourceNote() == null) {
            return new ContextResponse(
                    ContextNavigationMode.SOURCE_MISSING,
                    taskResponse,
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

        NoteResponse noteResponse = NoteResponse.from(note);

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
                    libraryVideo.getId());
        }

        return new ContextResponse(
                ContextNavigationMode.SOURCE_PREVIEW,
                task,
                noteResponse,
                null);
    }

    private ContextResponse videoUnavailable(
            TaskResponse task,
            NoteResponse note) {

        return new ContextResponse(
                ContextNavigationMode.VIDEO_UNAVAILABLE,
                task,
                note,
                null);
    }
}