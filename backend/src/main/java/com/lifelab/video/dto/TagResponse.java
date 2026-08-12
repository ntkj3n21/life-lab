package com.lifelab.video.dto;

import java.time.OffsetDateTime;

import com.lifelab.video.domain.Tag;

public record TagResponse(
        Long id,
        String name,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static TagResponse from(Tag tag) {
        return new TagResponse(
                tag.getId(),
                tag.getName(),
                tag.getCreatedAt(),
                tag.getUpdatedAt());
    }
}
