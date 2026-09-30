package com.lifelab.source.image.dto;

import jakarta.validation.constraints.Size;

public record UpdateLibraryImageRequest(
        @Size(max = 255) String title,
        @Size(max = 2000) String personalDescription) {
}
