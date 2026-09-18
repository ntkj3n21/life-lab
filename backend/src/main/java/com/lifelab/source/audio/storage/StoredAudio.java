package com.lifelab.source.audio.storage;

public record StoredAudio(
        String storageKey,
        String originalFilename,
        String mediaType,
        long sizeBytes) {
}
