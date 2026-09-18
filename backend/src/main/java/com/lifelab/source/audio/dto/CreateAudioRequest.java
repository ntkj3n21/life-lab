package com.lifelab.source.audio.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateAudioRequest(
        @NotBlank @Size(max = 4096) String url,
        @Size(max = 255) String title) {
}
