package com.lifelab.video.dto;

import jakarta.validation.constraints.NotBlank;

public record AddLibraryVideoRequest(@NotBlank String youtubeUrl) {
}
