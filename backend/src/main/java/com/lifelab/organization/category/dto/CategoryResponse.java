package com.lifelab.organization.category.dto;

import java.time.OffsetDateTime;

import com.lifelab.organization.category.domain.Category;

public record CategoryResponse(
        Long id,
        String name,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static CategoryResponse from(Category category) {
        if (category == null) {
            return null;
        }
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getCreatedAt(),
                category.getUpdatedAt());
    }
}
