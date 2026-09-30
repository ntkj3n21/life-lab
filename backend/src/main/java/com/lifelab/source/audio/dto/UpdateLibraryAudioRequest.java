package com.lifelab.source.audio.dto;

import jakarta.validation.constraints.Size;

public record UpdateLibraryAudioRequest(
        @Size(max = 255) String title,
        @Size(max = 2000) String personalDescription) {
}
