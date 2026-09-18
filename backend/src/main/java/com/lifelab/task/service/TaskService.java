package com.lifelab.task.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.exception.UnauthenticatedException;
import com.lifelab.common.text.SearchKeywordNormalizer;
import com.lifelab.note.domain.Note;
import com.lifelab.note.exception.NoteNotFoundException;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.organization.service.ItemOrganizationService;
import com.lifelab.source.audio.domain.LibraryAudio;
import com.lifelab.source.audio.exception.LibraryAudioNotFoundException;
import com.lifelab.source.audio.repository.LibraryAudioRepository;
import com.lifelab.source.image.domain.LibraryImage;
import com.lifelab.source.image.exception.LibraryImageNotFoundException;
import com.lifelab.source.image.repository.LibraryImageRepository;
import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskSourceStatus;
import com.lifelab.task.domain.TaskStatus;
import com.lifelab.task.dto.CreateTaskRequest;
import com.lifelab.task.dto.TaskResponse;
import com.lifelab.task.dto.UpdateTaskRequest;
import com.lifelab.task.dto.UpdateTaskStatusRequest;
import com.lifelab.task.exception.TaskNotFoundException;
import com.lifelab.task.repository.TaskRepository;
import com.lifelab.task.repository.TaskSpecifications;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.exception.LibraryVideoNotFoundException;
import com.lifelab.video.repository.LibraryVideoRepository;

@Service
public class TaskService {

    private final AccountRepository accountRepository;
    private final NoteRepository noteRepository;
    private final TaskRepository taskRepository;
    private final LibraryVideoRepository libraryVideoRepository;
    private final LibraryImageRepository libraryImageRepository;
    private final LibraryAudioRepository libraryAudioRepository;
    private final ItemOrganizationService organizationService;
    private final Clock clock;

    public TaskService(
            AccountRepository accountRepository,
            NoteRepository noteRepository,
            TaskRepository taskRepository,
            LibraryVideoRepository libraryVideoRepository,
            LibraryImageRepository libraryImageRepository,
            LibraryAudioRepository libraryAudioRepository,
            ItemOrganizationService organizationService,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.noteRepository = noteRepository;
        this.taskRepository = taskRepository;
        this.libraryVideoRepository = libraryVideoRepository;
        this.libraryImageRepository = libraryImageRepository;
        this.libraryAudioRepository = libraryAudioRepository;
        this.organizationService = organizationService;
        this.clock = clock;
    }

    @Transactional
    public TaskResponse createIndependentTask(Long accountId, CreateTaskRequest request) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(UnauthenticatedException::new);

        Task task = Task.createIndependent(
                account,
                request.title(),
                request.description(),
                request.deadline(),
                OffsetDateTime.now(clock));

        return organizationService.toTaskResponse(taskRepository.saveAndFlush(task));
    }

    @Transactional
    public TaskResponse createTaskFromNote(
            Long accountId,
            Long noteId,
            CreateTaskRequest request) {
        Note note = noteRepository.findByIdAndAccount_Id(noteId, accountId)
                .orElseThrow(NoteNotFoundException::new);

        Task task = Task.createFromNote(
                note,
                request.title(),
                request.description(),
                request.deadline(),
                OffsetDateTime.now(clock));

        return organizationService.toTaskResponse(taskRepository.saveAndFlush(task));
    }

    @Transactional(readOnly = true)
    public PagedResponse<TaskResponse> getTasks(
            Long accountId,
            int page,
            int size,
            String query,
            TaskStatus status,
            LocalDate deadlineFrom,
            LocalDate deadlineTo,
            Long libraryVideoId,
            Long libraryImageId,
            Long libraryAudioId,
            Long categoryId,
            List<Long> tagIds,
            TaskSourceStatus sourceStatus,
            String sortBy,
            String sortDirection) {
        organizationService.validateOwnedOrganizationFilters(accountId, categoryId, tagIds);

        Specification<Task> specification =
                TaskSpecifications.ownedBy(accountId);

        String keyword = SearchKeywordNormalizer.normalize(query);

        if (keyword != null) {
            specification =
                    specification.and(TaskSpecifications.keywordContains(keyword));
        }

        if (status != null) {
            specification =
                    specification.and(TaskSpecifications.hasStatus(status));
        }

        if (categoryId != null) {
            specification = specification.and(TaskSpecifications.hasCategory(categoryId));
        }

        if (tagIds != null && !tagIds.isEmpty()) {
            specification = specification.and(TaskSpecifications.hasAnyTag(tagIds));
        }

        if (sourceStatus != null) {
            specification = specification.and(TaskSpecifications.hasSourceStatus(sourceStatus));
        }

        if (deadlineFrom != null || deadlineTo != null) {
            specification = specification.and(
                    TaskSpecifications.deadlineBetween(deadlineFrom, deadlineTo));
        }

        if (libraryVideoId != null) {
            LibraryVideo libraryVideo = libraryVideoRepository
                    .findByIdAndAccount_Id(libraryVideoId, accountId)
                    .orElseThrow(LibraryVideoNotFoundException::new);

            specification = specification.and(
                    TaskSpecifications.hasSourceFromYoutubeVideo(
                            libraryVideo.getYoutubeSource().getId()));
        }


        if (libraryImageId != null) {
            LibraryImage libraryImage = libraryImageRepository
                    .findByIdAndAccount_Id(libraryImageId, accountId)
                    .orElseThrow(LibraryImageNotFoundException::new);

            specification = specification.and(
                    TaskSpecifications.hasSourceFromImage(
                            libraryImage.getImageSource().getId()));
        }

        if (libraryAudioId != null) {
            LibraryAudio libraryAudio = libraryAudioRepository
                    .findByIdAndAccount_Id(libraryAudioId, accountId)
                    .orElseThrow(LibraryAudioNotFoundException::new);

            specification = specification.and(
                    TaskSpecifications.hasSourceFromAudio(
                            libraryAudio.getAudioSource().getId()));
        }

        Sort.Direction direction = "asc".equals(sortDirection)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(direction, sortBy)
                        .and(Sort.by(direction, "id")));

        Page<Task> tasks =
                taskRepository.findAll(specification, pageRequest);

        return PagedResponse.from(organizationService.toTaskResponses(tasks));
    }

    @Transactional(readOnly = true)
    public TaskResponse getTask(Long accountId, Long taskId) {
        return organizationService.toTaskResponse(findOwnedTask(accountId, taskId));
    }

    @Transactional
    public TaskResponse updateTask(
            Long accountId,
            Long taskId,
            UpdateTaskRequest request) {
        Task task = findOwnedTask(accountId, taskId);

        task.updateDetails(
                request.title(),
                request.description(),
                request.deadline(),
                OffsetDateTime.now(clock));

        return organizationService.toTaskResponse(taskRepository.saveAndFlush(task));
    }

    @Transactional
    public TaskResponse changeTaskStatus(
            Long accountId,
            Long taskId,
            UpdateTaskStatusRequest request) {
        Task task = findOwnedTask(accountId, taskId);

        task.changeStatus(
                TaskStatus.valueOf(request.status()),
                OffsetDateTime.now(clock));

        return organizationService.toTaskResponse(taskRepository.saveAndFlush(task));
    }

    @Transactional
    public void deleteTask(Long accountId, Long taskId) {
        Task task = findOwnedTask(accountId, taskId);
        taskRepository.delete(task);
        taskRepository.flush();
    }

    private Task findOwnedTask(Long accountId, Long taskId) {
        return taskRepository.findByIdAndAccount_Id(taskId, accountId)
                .orElseThrow(TaskNotFoundException::new);
    }
}
