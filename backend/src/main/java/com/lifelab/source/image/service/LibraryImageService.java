package com.lifelab.source.image.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.exception.UnauthenticatedException;
import com.lifelab.common.text.SearchKeywordNormalizer;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.source.common.HttpSourceUrlValidator;
import com.lifelab.source.image.domain.ImageOrigin;
import com.lifelab.source.image.domain.ImageSource;
import com.lifelab.source.image.domain.LibraryImage;
import com.lifelab.source.image.domain.LibraryImageTag;
import com.lifelab.source.image.dto.CreateExternalImageRequest;
import com.lifelab.source.image.dto.ImageContent;
import com.lifelab.source.image.dto.LibraryImageResponse;
import com.lifelab.source.image.dto.UpdateLibraryImageRequest;
import com.lifelab.source.image.exception.ImageContentNotFoundException;
import com.lifelab.source.image.exception.InvalidImageRequestException;
import com.lifelab.source.image.exception.LibraryImageAlreadyExistsException;
import com.lifelab.source.image.exception.LibraryImageNotFoundException;
import com.lifelab.source.image.repository.ImageSourceRepository;
import com.lifelab.source.image.repository.LibraryImageRepository;
import com.lifelab.source.image.repository.LibraryImageSpecifications;
import com.lifelab.source.image.repository.LibraryImageTagRepository;
import com.lifelab.source.image.storage.LocalImageStorage;
import com.lifelab.source.image.storage.StoredImage;
import com.lifelab.video.domain.Tag;
import com.lifelab.video.dto.TagResponse;
import com.lifelab.video.exception.TagNotFoundException;
import com.lifelab.video.repository.TagRepository;

@Service
public class LibraryImageService {

    private final AccountRepository accountRepository;
    private final ImageSourceRepository imageSourceRepository;
    private final LibraryImageRepository libraryImageRepository;
    private final LibraryImageTagRepository libraryImageTagRepository;
    private final TagRepository tagRepository;
    private final NoteRepository noteRepository;
    private final LocalImageStorage imageStorage;
    private final Clock clock;

    public LibraryImageService(
            AccountRepository accountRepository,
            ImageSourceRepository imageSourceRepository,
            LibraryImageRepository libraryImageRepository,
            LibraryImageTagRepository libraryImageTagRepository,
            TagRepository tagRepository,
            NoteRepository noteRepository,
            LocalImageStorage imageStorage,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.imageSourceRepository = imageSourceRepository;
        this.libraryImageRepository = libraryImageRepository;
        this.libraryImageTagRepository = libraryImageTagRepository;
        this.tagRepository = tagRepository;
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
        return getLibrary(accountId, page, size, q, null, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public PagedResponse<LibraryImageResponse> getLibrary(
            Long accountId, int page, int size, String q, List<Long> tagIds,
            Boolean hasNotes, ImageOrigin origin, LocalDate addedFrom, LocalDate addedTo,
            String sortBy, String sortDirection) {
        validateDates(addedFrom, addedTo);
        String field = validateSortBy(sortBy);
        boolean ascending = validateDirection(sortDirection);
        List<Long> ownedTags = validateTagIds(accountId, tagIds);

        Specification<LibraryImage> spec = LibraryImageSpecifications.ownedBy(accountId);
        String keyword = SearchKeywordNormalizer.normalize(q);
        if (keyword != null) spec = spec.and(LibraryImageSpecifications.keywordContains(keyword));
        if (!ownedTags.isEmpty()) spec = spec.and(LibraryImageSpecifications.hasAnyTagId(ownedTags));
        if (hasNotes != null) spec = spec.and(LibraryImageSpecifications.hasNotes(accountId, hasNotes));
        if (origin != null) spec = spec.and(LibraryImageSpecifications.origin(origin));
        if (addedFrom != null || addedTo != null) spec = spec.and(LibraryImageSpecifications.addedBetween(addedFrom, addedTo));
        spec = spec.and(LibraryImageSpecifications.orderedBy(field, ascending));

        Page<LibraryImage> images = libraryImageRepository.findAll(spec, PageRequest.of(page, size, Sort.unsorted()));
        Map<Long, List<TagResponse>> tags = tagsByImageId(images.getContent());
        return PagedResponse.from(images.map(image -> LibraryImageResponse.from(
                image, tags.getOrDefault(image.getId(), List.of()))));
    }

    @Transactional(readOnly = true)
    public LibraryImageResponse getImage(Long accountId, Long imageId) {
        LibraryImage image = findOwnedImage(accountId, imageId);
        return LibraryImageResponse.from(image, tagsForImage(imageId));
    }

    @Transactional
    public LibraryImageResponse updateImage(Long accountId, Long imageId, UpdateLibraryImageRequest request) {
        LibraryImage image = findOwnedImage(accountId, imageId);
        image.updatePersonalInfo(normalizeTitle(request.title()), normalizeDescription(request.personalDescription()));
        return LibraryImageResponse.from(image, tagsForImage(imageId));
    }

    @Transactional(readOnly = true)
    public List<TagResponse> getTags(Long accountId, Long imageId) {
        findOwnedImage(accountId, imageId);
        return tagsForImage(imageId);
    }

    @Transactional
    public void attachTag(Long accountId, Long imageId, Long tagId) {
        LibraryImage image = findOwnedImage(accountId, imageId);
        Tag tag = tagRepository.findByIdAndAccount_Id(tagId, accountId).orElseThrow(TagNotFoundException::new);
        if (!libraryImageTagRepository.existsByLibraryImage_IdAndTag_Id(imageId, tagId)) {
            libraryImageTagRepository.saveAndFlush(LibraryImageTag.create(image, tag));
        }
    }

    @Transactional
    public void detachTag(Long accountId, Long imageId, Long tagId) {
        findOwnedImage(accountId, imageId);
        tagRepository.findByIdAndAccount_Id(tagId, accountId).orElseThrow(TagNotFoundException::new);
        libraryImageTagRepository.deleteByLibraryImage_IdAndTag_Id(imageId, tagId);
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

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) return null;
        String normalized = description.trim();
        if (normalized.length() > 2000) throw new InvalidImageRequestException("personalDescription", "must not exceed 2000 characters");
        return normalized;
    }

    private void validateDates(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new InvalidImageRequestException("addedFrom", "must be on or before addedTo");
        }
        if (to != null && to.equals(LocalDate.MAX)) {
            throw new InvalidImageRequestException("addedTo", "must be before the maximum date");
        }
    }

    private String validateSortBy(String sortBy) {
        if (sortBy == null) return "addedAt";
        if (!List.of("addedAt", "title").contains(sortBy)) throw new InvalidImageRequestException("sortBy", "must be addedAt or title");
        return sortBy;
    }

    private boolean validateDirection(String direction) {
        if (direction == null || "desc".equals(direction)) return false;
        if ("asc".equals(direction)) return true;
        throw new InvalidImageRequestException("sortDirection", "must be asc or desc");
    }

    private List<Long> validateTagIds(Long accountId, List<Long> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) return List.of();
        List<Long> distinct = new LinkedHashSet<>(tagIds).stream().toList();
        if (tagRepository.findAllByAccount_IdAndIdIn(accountId, distinct).size() != distinct.size()) {
            throw new TagNotFoundException();
        }
        return distinct;
    }

    private List<TagResponse> tagsForImage(Long imageId) {
        return libraryImageTagRepository.findWithTagsByLibraryImageIds(List.of(imageId)).stream()
                .map(relation -> TagResponse.from(relation.getTag())).toList();
    }

    private Map<Long, List<TagResponse>> tagsByImageId(List<LibraryImage> images) {
        if (images.isEmpty()) return Map.of();
        return libraryImageTagRepository.findWithTagsByLibraryImageIds(
                images.stream().map(LibraryImage::getId).toList()).stream()
                .collect(Collectors.groupingBy(relation -> relation.getLibraryImage().getId(),
                        Collectors.mapping(relation -> TagResponse.from(relation.getTag()), Collectors.toList())));
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
