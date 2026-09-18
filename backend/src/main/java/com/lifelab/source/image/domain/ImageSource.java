package com.lifelab.source.image.domain;

import java.time.OffsetDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "image_sources")
public class ImageSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar")
    private ImageOrigin origin;

    @Column(name = "external_url", columnDefinition = "text")
    private String externalUrl;

    @Size(max = 255)
    @Column(name = "storage_key", length = 255)
    private String storageKey;

    @Size(max = 255)
    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Size(max = 100)
    @Column(name = "media_type", length = 100)
    private String mediaType;

    @PositiveOrZero
    @Column(name = "size_bytes")
    private Long sizeBytes;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected ImageSource() {
    }

    public static ImageSource external(String externalUrl, OffsetDateTime now) {
        ImageSource source = new ImageSource();
        source.origin = ImageOrigin.EXTERNAL;
        source.externalUrl = externalUrl;
        source.createdAt = now;
        return source;
    }

    public static ImageSource upload(
            String storageKey,
            String originalFilename,
            String mediaType,
            long sizeBytes,
            OffsetDateTime now) {
        ImageSource source = new ImageSource();
        source.origin = ImageOrigin.UPLOAD;
        source.storageKey = storageKey;
        source.originalFilename = originalFilename;
        source.mediaType = mediaType;
        source.sizeBytes = sizeBytes;
        source.createdAt = now;
        return source;
    }

    public Long getId() {
        return id;
    }

    public ImageOrigin getOrigin() {
        return origin;
    }

    public String getExternalUrl() {
        return externalUrl;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public String getMediaType() {
        return mediaType;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }
}
