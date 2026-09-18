package com.lifelab.source.image.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

@ConfigurationProperties(prefix = "app.image-storage")
public record ImageStorageProperties(String location, DataSize maxUploadSize) {

    public ImageStorageProperties {
        if (location == null || location.isBlank()) {
            throw new IllegalArgumentException("app.image-storage.location must not be blank.");
        }
        if (maxUploadSize == null || maxUploadSize.toBytes() < 1) {
            throw new IllegalArgumentException("app.image-storage.max-upload-size must be positive.");
        }
    }
}
