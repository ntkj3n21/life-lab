package com.lifelab.note.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateNoteRequest(
        @NotBlank
        @Pattern(
                regexp = "(?Us).*\\S.*",
                message = "must contain meaningful non-whitespace text")
        String content) {
}
