package com.lifelab.source.image.dto;

import java.time.OffsetDateTime;
import java.util.List;

import com.lifelab.source.image.domain.ImageOrigin;
import com.lifelab.source.image.domain.ImageSource;
import com.lifelab.source.image.domain.LibraryImage;
import com.lifelab.video.dto.TagResponse;

public record LibraryImageResponse(
        Long id,
        Long sourceId,
        ImageOrigin origin,
        String url,
        String originalFilename,
        String mediaType,
        Long sizeBytes,
        String title,
        String personalDescription,
        List<TagResponse> tags,
        OffsetDateTime addedAt) {

    public static LibraryImageResponse from(LibraryImage image) {
        return from(image, List.of());
    }

    public static LibraryImageResponse from(LibraryImage image, List<TagResponse> tags) {
        ImageSource source = image.getImageSource();

        return new LibraryImageResponse(
                image.getId(),
                source.getId(),
                source.getOrigin(),
                source.getExternalUrl(),
                source.getOriginalFilename(),
                source.getMediaType(),
                source.getSizeBytes(),
                image.getTitle(),
                image.getPersonalDescription(),
                tags,
                image.getAddedAt());
    }
}
