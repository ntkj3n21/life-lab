package com.lifelab.source.audio.dto;

import java.time.OffsetDateTime;

import com.lifelab.source.audio.domain.AudioSource;
import com.lifelab.source.audio.domain.AudioOrigin;
import com.lifelab.source.audio.domain.LibraryAudio;

public record LibraryAudioResponse(
        Long id,
        Long sourceId,
        AudioOrigin origin,
        String url,
        String originalFilename,
        String mediaType,
        Long sizeBytes,
        String title,
        OffsetDateTime addedAt) {

    public static LibraryAudioResponse from(LibraryAudio audio) {
        AudioSource source = audio.getAudioSource();
        return new LibraryAudioResponse(
                audio.getId(),
                source.getId(),
                source.getOrigin(),
                source.getExternalUrl(),
                source.getOriginalFilename(),
                source.getMediaType(),
                source.getSizeBytes(),
                audio.getTitle(),
                audio.getAddedAt());
    }
}
