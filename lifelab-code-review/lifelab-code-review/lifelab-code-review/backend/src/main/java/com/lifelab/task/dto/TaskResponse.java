package com.lifelab.task.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskSourceStatus;
import com.lifelab.task.domain.TaskStatus;

public record TaskResponse(
        Long id,
        String title,
        String description,
        TaskStatus status,
        LocalDate deadline,
        TaskSourceStatus sourceStatus,
        Long sourceNoteId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static TaskResponse from(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getStatus(),
                task.getDeadline(),
                task.getSourceStatus(),
                task.getSourceNote() == null ? null : task.getSourceNote().getId(),
                task.getCreatedAt(),
                task.getUpdatedAt());
    }
}
