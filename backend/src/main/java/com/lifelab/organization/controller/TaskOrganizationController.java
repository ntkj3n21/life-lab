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
@RequestMapping("/api/tasks/{taskId}/organization")
public class TaskOrganizationController {

    private final ItemOrganizationService organizationService;
    private final CurrentAccount currentAccount;

    public TaskOrganizationController(
            ItemOrganizationService organizationService,
            CurrentAccount currentAccount) {
        this.organizationService = organizationService;
        this.currentAccount = currentAccount;
    }

    @GetMapping
    public ItemOrganizationResponse getOrganization(@PathVariable Long taskId) {
        return organizationService.getTaskOrganization(
                currentAccount.requireAccountId(),
                taskId);
    }

    @PatchMapping
    public ItemOrganizationResponse updateOrganization(
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateItemOrganizationRequest request) {
        return organizationService.updateTaskOrganization(
                currentAccount.requireAccountId(),
                taskId,
                request);
    }
}
