package com.lifelab.organization.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateCategoryRequest(
        @NotBlank
        @Size(max = 100)
        @Pattern(
                regexp = "(?Us).*\\S.*",
                message = "must contain meaningful non-whitespace text")
        String name) {
}
