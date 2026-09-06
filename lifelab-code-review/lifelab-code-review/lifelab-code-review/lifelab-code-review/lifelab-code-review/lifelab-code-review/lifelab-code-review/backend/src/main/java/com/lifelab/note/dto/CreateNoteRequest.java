package com.lifelab.note.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

public record CreateNoteRequest(
        @NotBlank
        @Pattern(
                regexp = "(?Us).*\\S.*",
                message = "must contain meaningful non-whitespace text")
        String content,
        @PositiveOrZero
        Integer timestampSeconds,
        boolean withoutTimestampConfirmed) {
}
