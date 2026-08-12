package com.lifelab.note.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.common.dto.PagedResponse;
import com.lifelab.note.domain.Note;
import com.lifelab.note.dto.CreateNoteRequest;
import com.lifelab.note.dto.NoteDeleteImpactResponse;
import com.lifelab.note.dto.NoteResponse;
import com.lifelab.note.dto.UpdateNoteRequest;
import com.lifelab.note.exception.InvalidNoteRequestException;
import com.lifelab.note.exception.NoteNotFoundException;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.task.domain.Task;
import com.lifelab.task.repository.TaskRepository;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.exception.LibraryVideoNotFoundException;
import com.lifelab.video.repository.LibraryVideoRepository;

@Service
public class NoteService {

    private final LibraryVideoRepository libraryVideoRepository;
    private final NoteRepository noteRepository;
    private final TaskRepository taskRepository;
    private final Clock clock;

    public NoteService(
            LibraryVideoRepository libraryVideoRepository,
            NoteRepository noteRepository,
            TaskRepository taskRepository,
            Clock clock) {
        this.libraryVideoRepository = libraryVideoRepository;
        this.noteRepository = noteRepository;
        this.taskRepository = taskRepository;
        this.clock = clock;
    }

    @Transactional
    public NoteResponse createNote(
            Long accountId,
            Long libraryVideoId,
            CreateNoteRequest request) {
        LibraryVideo libraryVideo = findOwnedLibraryVideo(accountId, libraryVideoId);
        if (request.timestampSeconds() == null && !request.withoutTimestampConfirmed()) {
            throw new InvalidNoteRequestException(Map.of(
                    "withoutTimestampConfirmed",
                    "must be true when timestampSeconds is omitted"));
        }
        Note note = Note.create(
                libraryVideo.getAccount(),
                libraryVideo.getYoutubeSource(),
                request.content(),
                request.timestampSeconds(),
                OffsetDateTime.now(clock));
        return NoteResponse.from(noteRepository.saveAndFlush(note));
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> getVideoNotes(Long accountId, Long libraryVideoId) {
        LibraryVideo libraryVideo = findOwnedLibraryVideo(accountId, libraryVideoId);
        return noteRepository.findVideoNotes(accountId, libraryVideo.getYoutubeSource().getId())
                .stream()
                .map(NoteResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PagedResponse<NoteResponse> getNotes(
            Long accountId,
            int page,
            int size,
            String query) {
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "createdAt")
                        .and(Sort.by(Sort.Direction.DESC, "id")));
        String keyword = normalizeKeyword(query);
        Page<Note> notes = keyword == null
                ? noteRepository.findAllByAccount_Id(accountId, pageRequest)
                : noteRepository.searchByContent(accountId, keyword, pageRequest);
        return PagedResponse.from(notes.map(NoteResponse::from));
    }

    @Transactional(readOnly = true)
    public NoteResponse getNote(Long accountId, Long noteId) {
        return NoteResponse.from(findOwnedNote(accountId, noteId));
    }

    @Transactional
    public NoteResponse updateNote(Long accountId, Long noteId, UpdateNoteRequest request) {
        Note note = findOwnedNote(accountId, noteId);
        note.updateContent(request.content(), OffsetDateTime.now(clock));
        return NoteResponse.from(noteRepository.saveAndFlush(note));
    }

    @Transactional(readOnly = true)
    public NoteDeleteImpactResponse getDeleteImpact(Long accountId, Long noteId) {
        Note note = findOwnedNote(accountId, noteId);
        return new NoteDeleteImpactResponse(
                note.getId(),
                taskRepository.countByAccount_IdAndSourceNote_Id(accountId, noteId),
                true,
                true);
    }

    @Transactional
    public void deleteNote(Long accountId, Long noteId) {
        Note note = findOwnedNote(accountId, noteId);
        List<Task> linkedTasks = taskRepository.findAllByAccount_IdAndSourceNote_Id(accountId, noteId);
        OffsetDateTime now = OffsetDateTime.now(clock);
        linkedTasks.forEach(task -> task.markSourceMissing(now));
        taskRepository.saveAllAndFlush(linkedTasks);
        noteRepository.delete(note);
        noteRepository.flush();
    }

    private LibraryVideo findOwnedLibraryVideo(Long accountId, Long libraryVideoId) {
        return libraryVideoRepository.findByIdAndAccount_Id(libraryVideoId, accountId)
                .orElseThrow(LibraryVideoNotFoundException::new);
    }

    private Note findOwnedNote(Long accountId, Long noteId) {
        return noteRepository.findByIdAndAccount_Id(noteId, accountId)
                .orElseThrow(NoteNotFoundException::new);
    }

    private String normalizeKeyword(String query) {
        if (query == null) {
            return null;
        }
        String stripped = query.strip();
        return stripped.isEmpty() ? null : stripped.toLowerCase(Locale.ROOT);
    }
}
