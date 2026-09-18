package com.lifelab.task.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import com.lifelab.organization.category.dto.CategoryResponse;
import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskSourceStatus;
import com.lifelab.task.domain.TaskStatus;
import com.lifelab.video.dto.TagResponse;

public record TaskResponse(
        Long id,
        String title,
        String description,
        TaskStatus status,
        LocalDate deadline,
        TaskSourceStatus sourceStatus,
        Long sourceNoteId,
        CategoryResponse category,
        List<TagResponse> tags,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public TaskResponse {
        tags = tags == null ? List.of() : List.copyOf(tags);
    }

    public static TaskResponse from(Task task, List<TagResponse> tags) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getStatus(),
                task.getDeadline(),
                task.getSourceStatus(),
                task.getSourceNote() == null ? null : task.getSourceNote().getId(),
                CategoryResponse.from(task.getCategory()),
                tags,
                task.getCreatedAt(),
                task.getUpdatedAt());
    }
}
