package com.lifelab.context.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.context.dto.ContextResponse;
import com.lifelab.context.service.ContextService;

@RestController
@RequestMapping("/api/context")
public class ContextController {

    private final ContextService contextService;
    private final CurrentAccount currentAccount;

    public ContextController(
            ContextService contextService,
            CurrentAccount currentAccount) {
        this.contextService = contextService;
        this.currentAccount = currentAccount;
    }

    @GetMapping("/notes/{noteId}")
    public ContextResponse resolveFromNote(
            @PathVariable Long noteId) {

        return contextService.resolveFromNote(
                currentAccount.requireAccountId(),
                noteId);
    }

    @GetMapping("/tasks/{taskId}")
    public ContextResponse resolveFromTask(
            @PathVariable Long taskId) {

        return contextService.resolveFromTask(
                currentAccount.requireAccountId(),
                taskId);
    }
}