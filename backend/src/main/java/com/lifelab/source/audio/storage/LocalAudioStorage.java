package com.lifelab.source.audio.storage;

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

import com.lifelab.source.audio.exception.AudioContentNotFoundException;
import com.lifelab.source.audio.exception.AudioStorageException;
import com.lifelab.source.audio.exception.InvalidAudioRequestException;

import jakarta.annotation.PostConstruct;

@Component
public class LocalAudioStorage {

    private static final String MPEG_MEDIA_TYPE = "audio/mpeg";

    private final Path storageRoot;
    private final long maxUploadBytes;

    public LocalAudioStorage(AudioStorageProperties properties) {
        this.storageRoot = Path.of(properties.location()).toAbsolutePath().normalize();
        this.maxUploadBytes = properties.maxUploadSize().toBytes();
    }

    @PostConstruct
    void initialize() {
        try {
            Files.createDirectories(storageRoot);
        } catch (IOException exception) {
            throw new AudioStorageException("Audio storage could not be initialized.", exception);
        }
    }

    public StoredAudio store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidAudioRequestException("file", "must not be empty");
        }
        if (file.getSize() > maxUploadBytes) {
            throw new InvalidAudioRequestException(
                    "file",
                    "must not exceed " + maxUploadBytes + " bytes");
        }

        detectMp3(file);
        validateDeclaredType(file.getContentType());

        String storageKey = UUID.randomUUID() + ".mp3";
        Path destination = resolveStorageKey(storageKey);

        try (InputStream input = file.getInputStream()) {
            Files.copy(input, destination, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new AudioStorageException("The uploaded audio could not be stored.", exception);
        }

        return new StoredAudio(
                storageKey,
                sanitizeOriginalFilename(file.getOriginalFilename()),
                MPEG_MEDIA_TYPE,
                file.getSize());
    }

    public Resource load(String storageKey) {
        Path path = resolveStorageKey(storageKey);
        if (!Files.isRegularFile(path)) {
            throw new AudioContentNotFoundException();
        }

        try {
            Resource resource = new UrlResource(path.toUri());
            if (!resource.isReadable()) {
                throw new AudioContentNotFoundException();
            }
            return resource;
        } catch (IOException exception) {
            throw new AudioContentNotFoundException();
        }
    }

    public void deleteAfterFailedCreate(String storageKey) {
        try {
            Files.deleteIfExists(resolveStorageKey(storageKey));
        } catch (IOException ignored) {
            // Best-effort compensation for a failed database create.
        }
    }

    private void detectMp3(MultipartFile file) {
        byte[] header = new byte[4];
        int read;
        try (InputStream input = file.getInputStream()) {
            read = input.read(header);
        } catch (IOException exception) {
            throw new InvalidAudioRequestException("file", "could not be read");
        }

        boolean hasId3 = read >= 3
                && header[0] == 'I'
                && header[1] == 'D'
                && header[2] == '3';
        boolean hasMpegFrame = read >= 4
                && (header[0] & 0xFF) == 0xFF
                && (header[1] & 0xE0) == 0xE0
                && (header[1] & 0x18) != 0x08
                && (header[1] & 0x06) != 0
                && (header[2] & 0xF0) != 0
                && (header[2] & 0xF0) != 0xF0
                && (header[2] & 0x0C) != 0x0C;

        if (!hasId3 && !hasMpegFrame) {
            throw new InvalidAudioRequestException("file", "must contain MP3 audio");
        }
    }

    private void validateDeclaredType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return;
        }

        String normalized = contentType.toLowerCase(Locale.ROOT);
        if (!normalized.equals(MPEG_MEDIA_TYPE) && !normalized.equals("audio/mp3")) {
            throw new InvalidAudioRequestException(
                    "file",
                    "declared media type does not match MP3 audio content");
        }
    }

    private String sanitizeOriginalFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            return "audio.mp3";
        }
        String normalized = filename.replace('\\', '/');
        String basename = normalized.substring(normalized.lastIndexOf('/') + 1).trim();
        if (basename.isEmpty()) {
            return "audio.mp3";
        }
        return basename.length() <= 255 ? basename : basename.substring(basename.length() - 255);
    }

    private Path resolveStorageKey(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            throw new AudioContentNotFoundException();
        }
        Path path = storageRoot.resolve(storageKey).normalize();
        if (!path.getParent().equals(storageRoot)) {
            throw new AudioContentNotFoundException();
        }
        return path;
    }
}
