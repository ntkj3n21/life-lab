package com.lifelab.source.audio.dto;

import java.time.OffsetDateTime;
import java.util.List;

import com.lifelab.source.audio.domain.AudioSource;
import com.lifelab.source.audio.domain.AudioOrigin;
import com.lifelab.source.audio.domain.LibraryAudio;
import com.lifelab.video.dto.TagResponse;

public record LibraryAudioResponse(
        Long id,
        Long sourceId,
        AudioOrigin origin,
        String url,
        String originalFilename,
        String mediaType,
        Long sizeBytes,
        String title,
        String personalDescription,
        List<TagResponse> tags,
        OffsetDateTime addedAt) {

    public static LibraryAudioResponse from(LibraryAudio audio) {
        return from(audio, List.of());
    }

    public static LibraryAudioResponse from(LibraryAudio audio, List<TagResponse> tags) {
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
                audio.getPersonalDescription(),
                tags,
                audio.getAddedAt());
    }
}
