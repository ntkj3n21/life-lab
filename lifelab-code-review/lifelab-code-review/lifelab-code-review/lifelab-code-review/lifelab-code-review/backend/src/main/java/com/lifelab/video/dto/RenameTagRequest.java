package com.lifelab.video.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RenameTagRequest(
        @NotBlank @Size(max = 100) String name) {
}
