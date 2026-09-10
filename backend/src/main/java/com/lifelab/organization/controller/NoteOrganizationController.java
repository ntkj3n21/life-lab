package com.lifelab.organization.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.organization.dto.ItemOrganizationResponse;
import com.lifelab.organization.dto.UpdateItemOrganizationRequest;
import com.lifelab.organization.service.ItemOrganizationService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/notes/{noteId}/organization")
public class NoteOrganizationController {

    private final ItemOrganizationService organizationService;
    private final CurrentAccount currentAccount;

    public NoteOrganizationController(
            ItemOrganizationService organizationService,
            CurrentAccount currentAccount) {
        this.organizationService = organizationService;
        this.currentAccount = currentAccount;
    }

    @GetMapping
    public ItemOrganizationResponse getOrganization(@PathVariable Long noteId) {
        return organizationService.getNoteOrganization(
                currentAccount.requireAccountId(),
                noteId);
    }

    @PatchMapping
    public ItemOrganizationResponse updateOrganization(
            @PathVariable Long noteId,
            @Valid @RequestBody UpdateItemOrganizationRequest request) {
        return organizationService.updateNoteOrganization(
                currentAccount.requireAccountId(),
                noteId,
                request);
    }
}
