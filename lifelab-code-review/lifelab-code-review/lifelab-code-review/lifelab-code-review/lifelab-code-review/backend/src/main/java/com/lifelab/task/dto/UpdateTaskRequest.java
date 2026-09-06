package com.lifelab.task.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateTaskRequest(
        @NotBlank
        @Size(max = 255)
        @Pattern(
                regexp = "(?Us).*\\S.*",
                message = "must contain meaningful non-whitespace text")
        String title,
        String description,
        LocalDate deadline) {
}
