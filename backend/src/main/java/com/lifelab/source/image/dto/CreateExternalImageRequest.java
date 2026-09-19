package com.lifelab.source.image.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateExternalImageRequest(
        @NotBlank @Size(max = 4096) String url,
        @Size(max = 255) String title) {
}
