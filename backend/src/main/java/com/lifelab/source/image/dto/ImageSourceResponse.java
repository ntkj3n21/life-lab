package com.lifelab.source.image.dto;

import com.lifelab.source.image.domain.ImageOrigin;
import com.lifelab.source.image.domain.ImageSource;

public record ImageSourceResponse(
        Long id,
        ImageOrigin origin,
        String url,
        String originalFilename,
        String mediaType,
        Long sizeBytes) {

    public static ImageSourceResponse from(ImageSource source) {
        if (source == null) {
            return null;
        }
        return new ImageSourceResponse(
                source.getId(),
                source.getOrigin(),
                source.getExternalUrl(),
                source.getOriginalFilename(),
                source.getMediaType(),
                source.getSizeBytes());
    }
}
