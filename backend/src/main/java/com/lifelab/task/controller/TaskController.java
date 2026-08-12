package com.lifelab.task.controller;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.security.CurrentAccount;
import com.lifelab.common.validation.PaginationValidator;
import com.lifelab.task.domain.TaskStatus;
import com.lifelab.task.dto.CreateTaskRequest;
import com.lifelab.task.dto.TaskResponse;
import com.lifelab.task.dto.UpdateTaskRequest;
import com.lifelab.task.dto.UpdateTaskStatusRequest;
import com.lifelab.task.exception.InvalidTaskFilterException;
import com.lifelab.task.service.TaskService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final CurrentAccount currentAccount;

    public TaskController(TaskService taskService, CurrentAccount currentAccount) {
        this.taskService = taskService;
        this.currentAccount = currentAccount;
    }

    @PostMapping
    public ResponseEntity<TaskResponse> createIndependentTask(
            @Valid @RequestBody CreateTaskRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.createIndependentTask(
                currentAccount.requireAccountId(),
                request));
    }

    @GetMapping
    public PagedResponse<TaskResponse> getTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) LocalDate deadlineFrom,
            @RequestParam(required = false) LocalDate deadlineTo) {
        PaginationValidator.validate(page, size);
        TaskStatus parsedStatus = parseStatus(status);
        validateDeadlineRange(deadlineFrom, deadlineTo);

        return taskService.getTasks(
                currentAccount.requireAccountId(),
                page,
                size,
                q,
                parsedStatus,
                deadlineFrom,
                deadlineTo);
    }

    @GetMapping("/{taskId}")
    public TaskResponse getTask(@PathVariable Long taskId) {
        return taskService.getTask(currentAccount.requireAccountId(), taskId);
    }

    @PatchMapping("/{taskId}")
    public TaskResponse updateTask(
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateTaskRequest request) {
        return taskService.updateTask(currentAccount.requireAccountId(), taskId, request);
    }

    @PatchMapping("/{taskId}/status")
    public TaskResponse changeTaskStatus(
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateTaskStatusRequest request) {
        return taskService.changeTaskStatus(currentAccount.requireAccountId(), taskId, request);
    }

    @DeleteMapping("/{taskId}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long taskId) {
        taskService.deleteTask(currentAccount.requireAccountId(), taskId);
        return ResponseEntity.noContent().build();
    }

    private TaskStatus parseStatus(String status) {
        if (status == null) {
            return null;
        }

        try {
            return TaskStatus.valueOf(status);
        } catch (IllegalArgumentException exception) {
            throw new InvalidTaskFilterException(Map.of(
                    "status", "must be NOT_STARTED, IN_PROGRESS, or COMPLETED"));
        }
    }

    private void validateDeadlineRange(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            Map<String, String> fieldErrors = new LinkedHashMap<>();
            fieldErrors.put("deadlineFrom", "must be on or before deadlineTo");
            fieldErrors.put("deadlineTo", "must be on or after deadlineFrom");
            throw new InvalidTaskFilterException(fieldErrors);
        }
    }
}