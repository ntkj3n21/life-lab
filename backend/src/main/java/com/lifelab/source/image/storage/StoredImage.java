package com.lifelab.source.image.storage;

public record StoredImage(
        String storageKey,
        String originalFilename,
        String mediaType,
        long sizeBytes) {
}
