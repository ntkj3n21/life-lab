package com.lifelab.note.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.text.SearchKeywordNormalizer;
import com.lifelab.note.domain.Note;
import com.lifelab.note.domain.NoteSourceType;
import com.lifelab.note.dto.CreateImageNoteRequest;
import com.lifelab.note.dto.CreateNoteRequest;
import com.lifelab.note.dto.NoteDeleteImpactResponse;
import com.lifelab.note.dto.NoteResponse;
import com.lifelab.note.dto.UpdateNoteRequest;
import com.lifelab.note.exception.InvalidNoteRequestException;
import com.lifelab.note.exception.NoteNotFoundException;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.note.repository.NoteSpecifications;
import com.lifelab.organization.service.ItemOrganizationService;
import com.lifelab.source.audio.domain.LibraryAudio;
import com.lifelab.source.audio.exception.LibraryAudioNotFoundException;
import com.lifelab.source.audio.repository.LibraryAudioRepository;
import com.lifelab.source.image.domain.LibraryImage;
import com.lifelab.source.image.exception.LibraryImageNotFoundException;
import com.lifelab.source.image.repository.LibraryImageRepository;
import com.lifelab.task.domain.Task;
import com.lifelab.task.repository.TaskRepository;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.exception.LibraryVideoNotFoundException;
import com.lifelab.video.repository.LibraryVideoRepository;

@Service
public class NoteService {

    private final LibraryVideoRepository libraryVideoRepository;
    private final LibraryImageRepository libraryImageRepository;
    private final LibraryAudioRepository libraryAudioRepository;
    private final NoteRepository noteRepository;
    private final TaskRepository taskRepository;
    private final ItemOrganizationService organizationService;
    private final Clock clock;

    public NoteService(
            LibraryVideoRepository libraryVideoRepository,
            LibraryImageRepository libraryImageRepository,
            LibraryAudioRepository libraryAudioRepository,
            NoteRepository noteRepository,
            TaskRepository taskRepository,
            ItemOrganizationService organizationService,
            Clock clock) {
        this.libraryVideoRepository = libraryVideoRepository;
        this.libraryImageRepository = libraryImageRepository;
        this.libraryAudioRepository = libraryAudioRepository;
        this.noteRepository = noteRepository;
        this.taskRepository = taskRepository;
        this.organizationService = organizationService;
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

        return organizationService.toNoteResponse(noteRepository.saveAndFlush(note));
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> getVideoNotes(Long accountId, Long libraryVideoId) {
        LibraryVideo libraryVideo = findOwnedLibraryVideo(accountId, libraryVideoId);

        return organizationService.toNoteResponses(noteRepository.findVideoNotes(
                        accountId,
                        libraryVideo.getYoutubeSource().getId()));
    }

    @Transactional
    public NoteResponse createImageNote(
            Long accountId,
            Long imageId,
            CreateImageNoteRequest request) {
        LibraryImage image = findOwnedLibraryImage(accountId, imageId);
        Note note = Note.createImage(
                image.getAccount(),
                image.getImageSource(),
                request.content(),
                OffsetDateTime.now(clock));
        return organizationService.toNoteResponse(noteRepository.saveAndFlush(note));
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> getImageNotes(Long accountId, Long imageId) {
        LibraryImage image = findOwnedLibraryImage(accountId, imageId);
        return organizationService.toNoteResponses(noteRepository.findImageNotes(
                accountId,
                image.getImageSource().getId()));
    }

    @Transactional
    public NoteResponse createAudioNote(
            Long accountId,
            Long audioId,
            CreateNoteRequest request) {
        LibraryAudio audio = findOwnedLibraryAudio(accountId, audioId);
        validateTimestampConfirmation(request);
        Note note = Note.createAudio(
                audio.getAccount(),
                audio.getAudioSource(),
                request.content(),
                request.timestampSeconds(),
                OffsetDateTime.now(clock));
        return organizationService.toNoteResponse(noteRepository.saveAndFlush(note));
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> getAudioNotes(Long accountId, Long audioId) {
        LibraryAudio audio = findOwnedLibraryAudio(accountId, audioId);
        return organizationService.toNoteResponses(noteRepository.findAudioNotes(
                accountId,
                audio.getAudioSource().getId()));
    }

    @Transactional(readOnly = true)
    public PagedResponse<NoteResponse> getNotes(
            Long accountId,
            int page,
            int size,
            String query,
            Long categoryId,
            List<Long> tagIds,
            Boolean hasTimestamp,
            String sortBy,
            String sortDirection) {
        organizationService.validateOwnedOrganizationFilters(accountId, categoryId, tagIds);

        Sort.Direction direction = "asc".equals(sortDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(direction, sortBy)
                        .and(Sort.by(direction, "id")));

        String keyword = SearchKeywordNormalizer.normalize(query);
        Specification<Note> specification = NoteSpecifications.ownedBy(accountId);

        if (keyword != null) {
            specification = specification.and(NoteSpecifications.keywordContains(keyword));
        }
        if (categoryId != null) {
            specification = specification.and(NoteSpecifications.hasCategory(categoryId));
        }
        if (tagIds != null && !tagIds.isEmpty()) {
            specification = specification.and(NoteSpecifications.hasAnyTag(tagIds));
        }
        if (hasTimestamp != null) {
            specification = specification.and(NoteSpecifications.hasTimestamp(hasTimestamp));
        }

        Page<Note> notes = noteRepository.findAll(specification, pageRequest);
        return PagedResponse.from(organizationService.toNoteResponses(notes));
    }

    @Transactional(readOnly = true)
    public NoteResponse getNote(Long accountId, Long noteId) {
        return organizationService.toNoteResponse(findOwnedNote(accountId, noteId));
    }

    @Transactional
    public NoteResponse updateNote(Long accountId, Long noteId, UpdateNoteRequest request) {
        Note note = findOwnedNote(accountId, noteId);
        note.updateContent(request.content(), OffsetDateTime.now(clock));
        return organizationService.toNoteResponse(noteRepository.saveAndFlush(note));
    }

    @Transactional(readOnly = true)
    public NoteDeleteImpactResponse getDeleteImpact(Long accountId, Long noteId) {
        Note note = findOwnedNote(accountId, noteId);

        return new NoteDeleteImpactResponse(
                note.getId(),
                taskRepository.countByAccount_IdAndSourceNote_Id(accountId, noteId),
                true,
                note.getSourceType() == NoteSourceType.YOUTUBE,
                true);
    }

    @Transactional
    public void deleteNote(Long accountId, Long noteId) {
        Note note = findOwnedNote(accountId, noteId);
        List<Task> linkedTasks =
                taskRepository.findAllByAccount_IdAndSourceNote_Id(accountId, noteId);
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

    private LibraryImage findOwnedLibraryImage(Long accountId, Long imageId) {
        return libraryImageRepository.findByIdAndAccount_Id(imageId, accountId)
                .orElseThrow(LibraryImageNotFoundException::new);
    }

    private LibraryAudio findOwnedLibraryAudio(Long accountId, Long audioId) {
        return libraryAudioRepository.findByIdAndAccount_Id(audioId, accountId)
                .orElseThrow(LibraryAudioNotFoundException::new);
    }

    private void validateTimestampConfirmation(CreateNoteRequest request) {
        if (request.timestampSeconds() == null && !request.withoutTimestampConfirmed()) {
            throw new InvalidNoteRequestException(Map.of(
                    "withoutTimestampConfirmed",
                    "must be true when timestampSeconds is omitted"));
        }
    }

    private Note findOwnedNote(Long accountId, Long noteId) {
        return noteRepository.findByIdAndAccount_Id(noteId, accountId)
                .orElseThrow(NoteNotFoundException::new);
    }
}
