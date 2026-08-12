package com.lifelab.video.dto;

import jakarta.validation.constraints.Size;

public record UpdateLibraryVideoRequest(
        @Size(max = 255) String customTitle,
        String personalDescription) {
}
