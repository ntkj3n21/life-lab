package com.lifelab.organization.dto;

import java.util.List;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateItemOrganizationRequest(
        Long categoryId,
        @NotNull
        @Size(max = 50)
        List<@NotNull Long> tagIds) {
}
