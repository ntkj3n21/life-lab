package com.lifelab.source.image.dto;

import java.time.OffsetDateTime;

import com.lifelab.source.image.domain.ImageOrigin;
import com.lifelab.source.image.domain.ImageSource;
import com.lifelab.source.image.domain.LibraryImage;

public record LibraryImageResponse(
        Long id,
        Long sourceId,
        ImageOrigin origin,
        String url,
        String originalFilename,
        String mediaType,
        Long sizeBytes,
        OffsetDateTime addedAt) {

    public static LibraryImageResponse from(LibraryImage image) {
        ImageSource source = image.getImageSource();
        return new LibraryImageResponse(
                image.getId(),
                source.getId(),
                source.getOrigin(),
                source.getExternalUrl(),
                source.getOriginalFilename(),
                source.getMediaType(),
                source.getSizeBytes(),
                image.getAddedAt());
    }
}
