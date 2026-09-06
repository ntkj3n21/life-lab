package com.lifelab.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateTaskStatusRequest(
        @NotBlank
        @Pattern(
                regexp = "NOT_STARTED|IN_PROGRESS|COMPLETED",
                message = "must be NOT_STARTED, IN_PROGRESS, or COMPLETED")
        String status) {
}
