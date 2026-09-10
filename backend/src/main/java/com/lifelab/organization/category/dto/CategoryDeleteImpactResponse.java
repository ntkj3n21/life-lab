package com.lifelab.organization.category.dto;

public record CategoryDeleteImpactResponse(
        Long categoryId,
        long noteCountToUncategorize,
        long taskCountToUncategorize,
        boolean notesPreserved,
        boolean tasksPreserved) {
}
