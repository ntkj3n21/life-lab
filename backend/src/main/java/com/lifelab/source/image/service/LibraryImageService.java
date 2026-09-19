package com.lifelab.source.image.service;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.exception.UnauthenticatedException;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.source.common.HttpSourceUrlValidator;
import com.lifelab.source.image.domain.ImageOrigin;
import com.lifelab.source.image.domain.ImageSource;
import com.lifelab.source.image.domain.LibraryImage;
import com.lifelab.source.image.dto.CreateExternalImageRequest;
import com.lifelab.source.image.dto.ImageContent;
import com.lifelab.source.image.dto.LibraryImageResponse;
import com.lifelab.source.image.exception.ImageContentNotFoundException;
import com.lifelab.source.image.exception.InvalidImageRequestException;
import com.lifelab.source.image.exception.LibraryImageAlreadyExistsException;
import com.lifelab.source.image.exception.LibraryImageNotFoundException;
import com.lifelab.source.image.repository.ImageSourceRepository;
import com.lifelab.source.image.repository.LibraryImageRepository;
import com.lifelab.source.image.storage.LocalImageStorage;
import com.lifelab.source.image.storage.StoredImage;

@Service
public class LibraryImageService {

    private final AccountRepository accountRepository;
    private final ImageSourceRepository imageSourceRepository;
    private final LibraryImageRepository libraryImageRepository;
    private final NoteRepository noteRepository;
    private final LocalImageStorage imageStorage;
    private final Clock clock;

    public LibraryImageService(
            AccountRepository accountRepository,
            ImageSourceRepository imageSourceRepository,
            LibraryImageRepository libraryImageRepository,
            NoteRepository noteRepository,
            LocalImageStorage imageStorage,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.imageSourceRepository = imageSourceRepository;
        this.libraryImageRepository = libraryImageRepository;
        this.noteRepository = noteRepository;
        this.imageStorage = imageStorage;
        this.clock = clock;
    }

    @Transactional
    public LibraryImageResponse addExternalImage(Long accountId, CreateExternalImageRequest request) {
        Account account = requireAccount(accountId);
        String url;
        try {
            url = HttpSourceUrlValidator.normalize(request.url());
        } catch (IllegalArgumentException exception) {
            throw new InvalidImageRequestException("url", exception.getMessage());
        }

        String title = normalizeTitle(request.title());

        OffsetDateTime now = OffsetDateTime.now(clock);
        ImageSource source = imageSourceRepository
                .findByOriginAndExternalUrl(ImageOrigin.EXTERNAL, url)
                .orElseGet(() -> imageSourceRepository.saveAndFlush(ImageSource.external(url, now)));

        return addMembership(
                account,
                source,
                title,
                now);
    }

    @Transactional
    public LibraryImageResponse uploadImage(Long accountId, MultipartFile file, String title) {
        Account account = requireAccount(accountId);
        StoredImage stored = imageStorage.store(file);
        OffsetDateTime now = OffsetDateTime.now(clock);

        try {
            ImageSource source = imageSourceRepository.saveAndFlush(ImageSource.upload(
                    stored.storageKey(),
                    stored.originalFilename(),
                    stored.mediaType(),
                    stored.sizeBytes(),
                    now));
            String normalizedTitle = normalizeTitle(title);

            String effectiveTitle = normalizedTitle != null
                    ? normalizedTitle
                    : defaultTitleFromFilename(
                            stored.originalFilename());

            return addMembership(
                    account,
                    source,
                    effectiveTitle,
                    now);
        } catch (RuntimeException exception) {
            imageStorage.deleteAfterFailedCreate(stored.storageKey());
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<LibraryImageResponse> getLibrary(
            Long accountId,
            int page,
            int size,
            String q) {
        PageRequest pageRequest = PageRequest.of(
                page,
                size,
                Sort.by(Sort.Order.desc("addedAt"), Sort.Order.desc("id")));

        String normalizedQuery = normalizeSearch(q);

        Page<LibraryImage> images = normalizedQuery == null
                ? libraryImageRepository.findAllByAccount_Id(
                        accountId,
                        pageRequest)
                : libraryImageRepository.searchByAccount(
                        accountId,
                        normalizedQuery,
                        pageRequest);

        return PagedResponse.from(
                images.map(LibraryImageResponse::from));
    }

    @Transactional(readOnly = true)
    public LibraryImageResponse getImage(Long accountId, Long imageId) {
        return LibraryImageResponse.from(findOwnedImage(accountId, imageId));
    }

    @Transactional
    public void removeImage(Long accountId, Long imageId) {
        libraryImageRepository.delete(findOwnedImage(accountId, imageId));
    }

    @Transactional(readOnly = true)
    public ImageContent getUploadedContent(Long accountId, Long sourceId) {
        boolean canAccess = libraryImageRepository
                .existsByAccount_IdAndImageSource_Id(accountId, sourceId)
                || noteRepository.existsByAccount_IdAndImageSource_Id(accountId, sourceId);
        if (!canAccess) {
            throw new ImageContentNotFoundException();
        }

        ImageSource source = imageSourceRepository.findById(sourceId)
                .orElseThrow(ImageContentNotFoundException::new);
        if (source.getOrigin() != ImageOrigin.UPLOAD) {
            throw new ImageContentNotFoundException();
        }

        return new ImageContent(
                imageStorage.load(source.getStorageKey()),
                source.getMediaType(),
                source.getSizeBytes());
    }

    private LibraryImageResponse addMembership(
            Account account,
            ImageSource source,
            String title,
            OffsetDateTime now) {
        if (libraryImageRepository.existsByAccount_IdAndImageSource_Id(
                account.getId(), source.getId())) {
            throw new LibraryImageAlreadyExistsException();
        }

        try {
            LibraryImage image = libraryImageRepository.saveAndFlush(
                    LibraryImage.create(
                            account,
                            source,
                            title,
                            now));
            return LibraryImageResponse.from(image);
        } catch (DataIntegrityViolationException exception) {
            throw new LibraryImageAlreadyExistsException();
        }
    }

    private Account requireAccount(Long accountId) {
        return accountRepository.findById(accountId)
                .orElseThrow(UnauthenticatedException::new);
    }

    private LibraryImage findOwnedImage(Long accountId, Long imageId) {
        return libraryImageRepository.findByIdAndAccount_Id(imageId, accountId)
                .orElseThrow(LibraryImageNotFoundException::new);
    }

    private String normalizeTitle(String title) {
        if (title == null) {
            return null;
        }

        String normalized = title.trim();

        if (normalized.isEmpty()) {
            return null;
        }

        if (normalized.length() > 255) {
            throw new InvalidImageRequestException(
                    "title",
                    "must not exceed 255 characters");
        }

        return normalized;
    }

    private String normalizeSearch(String query) {
        if (query == null) {
            return null;
        }

        String normalized = query.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }

    private String defaultTitleFromFilename(
            String filename) {

        if (filename == null || filename.isBlank()) {
            return null;
        }

        String normalized = filename.trim();

        int extensionIndex = normalized.lastIndexOf('.');

        if (extensionIndex > 0) {
            String withoutExtension = normalized.substring(
                    0,
                    extensionIndex)
                    .trim();

            if (!withoutExtension.isEmpty()) {
                return withoutExtension;
            }
        }

        return normalized;
    }
}
