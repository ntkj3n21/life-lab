package com.lifelab.source.audio.dto;

import com.lifelab.source.audio.domain.AudioSource;
import com.lifelab.source.audio.domain.AudioOrigin;

public record AudioSourceResponse(
        Long id,
        AudioOrigin origin,
        String url,
        String originalFilename,
        String mediaType,
        Long sizeBytes) {

    public static AudioSourceResponse from(AudioSource source) {
        if (source == null) {
            return null;
        }
        return new AudioSourceResponse(
                source.getId(),
                source.getOrigin(),
                source.getExternalUrl(),
                source.getOriginalFilename(),
                source.getMediaType(),
                source.getSizeBytes());
    }
}
