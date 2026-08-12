package com.lifelab.task.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.util.Locale;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.common.exception.UnauthenticatedException;
import com.lifelab.common.dto.PagedResponse;
import com.lifelab.note.domain.Note;
import com.lifelab.note.exception.NoteNotFoundException;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskStatus;
import com.lifelab.task.dto.CreateTaskRequest;
import com.lifelab.task.dto.TaskResponse;
import com.lifelab.task.dto.UpdateTaskRequest;
import com.lifelab.task.dto.UpdateTaskStatusRequest;
import com.lifelab.task.repository.TaskRepository;
import com.lifelab.task.repository.TaskSpecifications;
import com.lifelab.task.exception.TaskNotFoundException;

@Service
public class TaskService {

    private final AccountRepository accountRepository;
    private final NoteRepository noteRepository;
    private final TaskRepository taskRepository;
    private final Clock clock;

    public TaskService(
            AccountRepository accountRepository,
            NoteRepository noteRepository,
            TaskRepository taskRepository,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.noteRepository = noteRepository;
        this.taskRepository = taskRepository;
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
        return TaskResponse.from(taskRepository.saveAndFlush(task));
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
        return TaskResponse.from(taskRepository.saveAndFlush(task));
    }

    @Transactional(readOnly = true)
    public PagedResponse<TaskResponse> getTasks(
            Long accountId,
            int page,
            int size,
            String query,
            TaskStatus status,
            LocalDate deadlineFrom,
            LocalDate deadlineTo) {
        Specification<Task> specification = TaskSpecifications.ownedBy(accountId);
        String keyword = normalizeKeyword(query);
        if (keyword != null) {
            specification = specification.and(TaskSpecifications.keywordContains(keyword));
        }
        if (status != null) {
            specification = specification.and(TaskSpecifications.hasStatus(status));
        }
        if (deadlineFrom != null || deadlineTo != null) {
            specification = specification.and(
                    TaskSpecifications.deadlineBetween(deadlineFrom, deadlineTo));
        }
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "createdAt")
                        .and(Sort.by(Sort.Direction.DESC, "id")));
        Page<Task> tasks = taskRepository.findAll(specification, pageRequest);
        return PagedResponse.from(tasks.map(TaskResponse::from));
    }

    @Transactional(readOnly = true)
    public TaskResponse getTask(Long accountId, Long taskId) {
        return TaskResponse.from(findOwnedTask(accountId, taskId));
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
        return TaskResponse.from(taskRepository.saveAndFlush(task));
    }

    @Transactional
    public TaskResponse changeTaskStatus(
            Long accountId,
            Long taskId,
            UpdateTaskStatusRequest request) {
        Task task = findOwnedTask(accountId, taskId);
        task.changeStatus(TaskStatus.valueOf(request.status()), OffsetDateTime.now(clock));
        return TaskResponse.from(taskRepository.saveAndFlush(task));
    }

    @Transactional
    public void deleteTask(Long accountId, Long taskId) {
        Task task = findOwnedTask(accountId, taskId);
        taskRepository.delete(task);
        taskRepository.flush();
    }

    private String normalizeKeyword(String query) {
        if (query == null) {
            return null;
        }
        String stripped = query.strip();
        return stripped.isEmpty() ? null : stripped.toLowerCase(Locale.ROOT);
    }

    private Task findOwnedTask(Long accountId, Long taskId) {
        return taskRepository.findByIdAndAccount_Id(taskId, accountId)
                .orElseThrow(TaskNotFoundException::new);
    }
}
