package com.lifelab.source.image.storage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.UUID;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.lifelab.source.image.exception.ImageContentNotFoundException;
import com.lifelab.source.image.exception.ImageStorageException;
import com.lifelab.source.image.exception.InvalidImageRequestException;

import jakarta.annotation.PostConstruct;

@Component
public class LocalImageStorage {

    private static final byte[] PNG_SIGNATURE = {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    };

    private final Path storageRoot;
    private final long maxUploadBytes;

    public LocalImageStorage(ImageStorageProperties properties) {
        this.storageRoot = Path.of(properties.location()).toAbsolutePath().normalize();
        this.maxUploadBytes = properties.maxUploadSize().toBytes();
    }

    @PostConstruct
    void initialize() {
        try {
            Files.createDirectories(storageRoot);
        } catch (IOException exception) {
            throw new ImageStorageException("Image storage could not be initialized.", exception);
        }
    }

    public StoredImage store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidImageRequestException("file", "must not be empty");
        }
        if (file.getSize() > maxUploadBytes) {
            throw new InvalidImageRequestException(
                    "file",
                    "must not exceed " + maxUploadBytes + " bytes");
        }

        DetectedImage detected = detectImage(file);
        validateDeclaredType(file.getContentType(), detected.mediaType());

        String storageKey = UUID.randomUUID() + detected.extension();
        Path destination = resolveStorageKey(storageKey);

        try (InputStream input = file.getInputStream()) {
            Files.copy(input, destination, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new ImageStorageException("The uploaded image could not be stored.", exception);
        }

        return new StoredImage(
                storageKey,
                sanitizeOriginalFilename(file.getOriginalFilename()),
                detected.mediaType(),
                file.getSize());
    }

    public Resource load(String storageKey) {
        Path path = resolveStorageKey(storageKey);
        if (!Files.isRegularFile(path)) {
            throw new ImageContentNotFoundException();
        }

        try {
            Resource resource = new UrlResource(path.toUri());
            if (!resource.isReadable()) {
                throw new ImageContentNotFoundException();
            }
            return resource;
        } catch (IOException exception) {
            throw new ImageContentNotFoundException();
        }
    }

    public void deleteAfterFailedCreate(String storageKey) {
        try {
            Files.deleteIfExists(resolveStorageKey(storageKey));
        } catch (IOException ignored) {
            // Best-effort compensation for a failed database create.
        }
    }

    private DetectedImage detectImage(MultipartFile file) {
        byte[] header = new byte[12];
        int read;
        try (InputStream input = file.getInputStream()) {
            read = input.read(header);
        } catch (IOException exception) {
            throw new InvalidImageRequestException("file", "could not be read");
        }

        if (read >= 3
                && (header[0] & 0xFF) == 0xFF
                && (header[1] & 0xFF) == 0xD8
                && (header[2] & 0xFF) == 0xFF) {
            return new DetectedImage("image/jpeg", ".jpg");
        }
        if (read >= PNG_SIGNATURE.length && startsWith(header, PNG_SIGNATURE)) {
            return new DetectedImage("image/png", ".png");
        }
        if (read >= 12
                && header[0] == 'R'
                && header[1] == 'I'
                && header[2] == 'F'
                && header[3] == 'F'
                && header[8] == 'W'
                && header[9] == 'E'
                && header[10] == 'B'
                && header[11] == 'P') {
            return new DetectedImage("image/webp", ".webp");
        }

        throw new InvalidImageRequestException(
                "file",
                "must be a JPG, JPEG, PNG, or WebP image");
    }

    private void validateDeclaredType(String contentType, String detectedType) {
        if (contentType == null || contentType.isBlank()) {
            return;
        }

        String normalized = contentType.toLowerCase(Locale.ROOT);
        boolean matches = normalized.equals(detectedType)
                || (detectedType.equals("image/jpeg") && normalized.equals("image/jpg"));
        if (!matches) {
            throw new InvalidImageRequestException(
                    "file",
                    "declared media type does not match the image content");
        }
    }

    private boolean startsWith(byte[] value, byte[] prefix) {
        for (int index = 0; index < prefix.length; index++) {
            if (value[index] != prefix[index]) {
                return false;
            }
        }
        return true;
    }

    private String sanitizeOriginalFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return null;
        }
        String normalized = filename.replace('\\', '/');
        String basename = normalized.substring(normalized.lastIndexOf('/') + 1).trim();
        if (basename.isEmpty()) {
            return null;
        }
        return basename.length() <= 255 ? basename : basename.substring(basename.length() - 255);
    }

    private Path resolveStorageKey(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw new ImageContentNotFoundException();
        }
        Path path = storageRoot.resolve(storageKey).normalize();
        if (!path.getParent().equals(storageRoot)) {
            throw new ImageContentNotFoundException();
        }
        return path;
    }

    private record DetectedImage(String mediaType, String extension) {
    }
}
