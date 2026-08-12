package com.lifelab.task.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.task.dto.CreateTaskRequest;
import com.lifelab.task.dto.TaskResponse;
import com.lifelab.task.service.TaskService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/notes/{noteId}/tasks")
public class NoteTaskController {

    private final TaskService taskService;
    private final CurrentAccount currentAccount;

    public NoteTaskController(TaskService taskService, CurrentAccount currentAccount) {
        this.taskService = taskService;
        this.currentAccount = currentAccount;
    }

    @PostMapping
    public ResponseEntity<TaskResponse> createTaskFromNote(
            @PathVariable Long noteId,
            @Valid @RequestBody CreateTaskRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.createTaskFromNote(
                currentAccount.requireAccountId(),
                noteId,
                request));
    }
}
