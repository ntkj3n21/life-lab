package com.lifelab.source.audio.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties(prefix = "app.audio-storage")
public record AudioStorageProperties(String location, DataSize maxUploadSize) {

    public AudioStorageProperties {
        if (location == null || location.isBlank()) {
            throw new IllegalArgumentException("app.audio-storage.location must not be blank.");
        }
        if (maxUploadSize == null || maxUploadSize.toBytes() < 1) {
            throw new IllegalArgumentException("app.audio-storage.max-upload-size must be positive.");
        }
    }
}
