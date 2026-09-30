package com.lifelab.source.audio.service;

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
import com.lifelab.source.audio.domain.AudioOrigin;
import com.lifelab.source.audio.domain.AudioSource;
import com.lifelab.source.audio.domain.LibraryAudio;
import com.lifelab.source.audio.domain.LibraryAudioTag;
import com.lifelab.source.audio.dto.AudioContent;
import com.lifelab.source.audio.dto.CreateAudioRequest;
import com.lifelab.source.audio.dto.LibraryAudioResponse;
import com.lifelab.source.audio.dto.UpdateLibraryAudioRequest;
import com.lifelab.source.audio.exception.AudioContentNotFoundException;
import com.lifelab.source.audio.exception.InvalidAudioRequestException;
import com.lifelab.source.audio.exception.LibraryAudioAlreadyExistsException;
import com.lifelab.source.audio.exception.LibraryAudioNotFoundException;
import com.lifelab.source.audio.repository.AudioSourceRepository;
import com.lifelab.source.audio.repository.LibraryAudioRepository;
import com.lifelab.source.audio.repository.LibraryAudioSpecifications;
import com.lifelab.source.audio.repository.LibraryAudioTagRepository;
import com.lifelab.source.audio.storage.LocalAudioStorage;
import com.lifelab.source.audio.storage.StoredAudio;
import com.lifelab.source.common.HttpSourceUrlValidator;
import com.lifelab.video.domain.Tag;
import com.lifelab.video.dto.TagResponse;
import com.lifelab.video.exception.TagNotFoundException;
import com.lifelab.video.repository.TagRepository;

@Service
public class LibraryAudioService {

    private final AccountRepository accountRepository;
    private final AudioSourceRepository audioSourceRepository;
    private final LibraryAudioRepository libraryAudioRepository;
    private final LibraryAudioTagRepository libraryAudioTagRepository;
    private final TagRepository tagRepository;
    private final NoteRepository noteRepository;
    private final LocalAudioStorage audioStorage;
    private final Clock clock;

    public LibraryAudioService(
            AccountRepository accountRepository,
            AudioSourceRepository audioSourceRepository,
            LibraryAudioRepository libraryAudioRepository,
            LibraryAudioTagRepository libraryAudioTagRepository,
            TagRepository tagRepository,
            NoteRepository noteRepository,
            LocalAudioStorage audioStorage,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.audioSourceRepository = audioSourceRepository;
        this.libraryAudioRepository = libraryAudioRepository;
        this.libraryAudioTagRepository = libraryAudioTagRepository;
        this.tagRepository = tagRepository;
        this.noteRepository = noteRepository;
        this.audioStorage = audioStorage;
        this.clock = clock;
    }

    @Transactional
    public LibraryAudioResponse addAudio(Long accountId, CreateAudioRequest request) {
        Account account = requireAccount(accountId);
        String url;
        try {
            url = HttpSourceUrlValidator.normalize(request.url());
        } catch (IllegalArgumentException exception) {
            throw new InvalidAudioRequestException("url", exception.getMessage());
        }

        String title = normalizeTitle(request.title());
        OffsetDateTime now = OffsetDateTime.now(clock);
        AudioSource source = audioSourceRepository.findByOriginAndExternalUrl(AudioOrigin.EXTERNAL, url)
                .orElseGet(() -> audioSourceRepository.saveAndFlush(
                        AudioSource.external(url, now)));

        return addMembership(account, source, title, now);
    }

    @Transactional
    public LibraryAudioResponse uploadAudio(
            Long accountId,
            MultipartFile file,
            String title) {
        Account account = requireAccount(accountId);
        StoredAudio stored = audioStorage.store(file);
        OffsetDateTime now = OffsetDateTime.now(clock);

        try {
            AudioSource source = audioSourceRepository.saveAndFlush(AudioSource.upload(
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
            audioStorage.deleteAfterFailedCreate(stored.storageKey());
            throw exception;
        }
    }

    private LibraryAudioResponse addMembership(
            Account account,
            AudioSource source,
            String title,
            OffsetDateTime now) {

        if (libraryAudioRepository.existsByAccount_IdAndAudioSource_Id(
                account.getId(), source.getId())) {
            throw new LibraryAudioAlreadyExistsException();
        }

        try {
            LibraryAudio audio = libraryAudioRepository.saveAndFlush(
                    LibraryAudio.create(account, source, title, now));
            return LibraryAudioResponse.from(audio);
        } catch (DataIntegrityViolationException exception) {
            throw new LibraryAudioAlreadyExistsException();
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<LibraryAudioResponse> getLibrary(
            Long accountId,
            int page,
            int size,
            String q) {
        return getLibrary(accountId, page, size, q, null, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public PagedResponse<LibraryAudioResponse> getLibrary(
            Long accountId, int page, int size, String q, List<Long> tagIds,
            Boolean hasNotes, AudioOrigin origin, LocalDate addedFrom, LocalDate addedTo,
            String sortBy, String sortDirection) {
        validateDates(addedFrom, addedTo);
        String field = validateSortBy(sortBy);
        boolean ascending = validateDirection(sortDirection);
        List<Long> ownedTags = validateTagIds(accountId, tagIds);

        Specification<LibraryAudio> spec = LibraryAudioSpecifications.ownedBy(accountId);
        String keyword = SearchKeywordNormalizer.normalize(q);
        if (keyword != null) spec = spec.and(LibraryAudioSpecifications.keywordContains(keyword));
        if (!ownedTags.isEmpty()) spec = spec.and(LibraryAudioSpecifications.hasAnyTagId(ownedTags));
        if (hasNotes != null) spec = spec.and(LibraryAudioSpecifications.hasNotes(accountId, hasNotes));
        if (origin != null) spec = spec.and(LibraryAudioSpecifications.origin(origin));
        if (addedFrom != null || addedTo != null) spec = spec.and(LibraryAudioSpecifications.addedBetween(addedFrom, addedTo));
        spec = spec.and(LibraryAudioSpecifications.orderedBy(field, ascending));

        Page<LibraryAudio> audio = libraryAudioRepository.findAll(spec, PageRequest.of(page, size, Sort.unsorted()));
        Map<Long, List<TagResponse>> tags = tagsByAudioId(audio.getContent());
        return PagedResponse.from(audio.map(item -> LibraryAudioResponse.from(
                item, tags.getOrDefault(item.getId(), List.of()))));
    }

    @Transactional(readOnly = true)
    public LibraryAudioResponse getAudio(Long accountId, Long audioId) {
        LibraryAudio audio = findOwnedAudio(accountId, audioId);
        return LibraryAudioResponse.from(audio, tagsForAudio(audioId));
    }

    @Transactional
    public LibraryAudioResponse updateAudio(Long accountId, Long audioId, UpdateLibraryAudioRequest request) {
        LibraryAudio audio = findOwnedAudio(accountId, audioId);
        audio.updatePersonalInfo(normalizeTitle(request.title()), normalizeDescription(request.personalDescription()));
        return LibraryAudioResponse.from(audio, tagsForAudio(audioId));
    }

    @Transactional(readOnly = true)
    public List<TagResponse> getTags(Long accountId, Long audioId) {
        findOwnedAudio(accountId, audioId);
        return tagsForAudio(audioId);
    }

    @Transactional
    public void attachTag(Long accountId, Long audioId, Long tagId) {
        LibraryAudio audio = findOwnedAudio(accountId, audioId);
        Tag tag = tagRepository.findByIdAndAccount_Id(tagId, accountId).orElseThrow(TagNotFoundException::new);
        if (!libraryAudioTagRepository.existsByLibraryAudio_IdAndTag_Id(audioId, tagId)) {
            libraryAudioTagRepository.saveAndFlush(LibraryAudioTag.create(audio, tag));
        }
    }

    @Transactional
    public void detachTag(Long accountId, Long audioId, Long tagId) {
        findOwnedAudio(accountId, audioId);
        tagRepository.findByIdAndAccount_Id(tagId, accountId).orElseThrow(TagNotFoundException::new);
        libraryAudioTagRepository.deleteByLibraryAudio_IdAndTag_Id(audioId, tagId);
    }

    @Transactional
    public void removeAudio(Long accountId, Long audioId) {
        libraryAudioRepository.delete(findOwnedAudio(accountId, audioId));
    }

    @Transactional(readOnly = true)
    public AudioContent getUploadedContent(Long accountId, Long sourceId) {
        boolean canAccess = libraryAudioRepository
                .existsByAccount_IdAndAudioSource_Id(accountId, sourceId)
                || noteRepository.existsByAccount_IdAndAudioSource_Id(accountId, sourceId);
        if (!canAccess) {
            throw new AudioContentNotFoundException();
        }

        AudioSource source = audioSourceRepository.findById(sourceId)
                .orElseThrow(AudioContentNotFoundException::new);
        if (source.getOrigin() != AudioOrigin.UPLOAD) {
            throw new AudioContentNotFoundException();
        }

        return new AudioContent(
                audioStorage.load(source.getStorageKey()),
                source.getMediaType(),
                source.getSizeBytes());
    }

    private Account requireAccount(Long accountId) {
        return accountRepository.findById(accountId)
                .orElseThrow(UnauthenticatedException::new);
    }

    private LibraryAudio findOwnedAudio(Long accountId, Long audioId) {
        return libraryAudioRepository.findByIdAndAccount_Id(audioId, accountId)
                .orElseThrow(LibraryAudioNotFoundException::new);
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
            throw new InvalidAudioRequestException(
                    "title",
                    "must not exceed 255 characters");
        }

        return normalized;
    }

    private String normalizeDescription(String description) {
        if (description == null || description.isBlank()) return null;
        String normalized = description.trim();
        if (normalized.length() > 2000) throw new InvalidAudioRequestException("personalDescription", "must not exceed 2000 characters");
        return normalized;
    }

    private void validateDates(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new InvalidAudioRequestException("addedFrom", "must be on or before addedTo");
        }
        if (to != null && to.equals(LocalDate.MAX)) {
            throw new InvalidAudioRequestException("addedTo", "must be before the maximum date");
        }
    }

    private String validateSortBy(String sortBy) {
        if (sortBy == null) return "addedAt";
        if (!List.of("addedAt", "title").contains(sortBy)) throw new InvalidAudioRequestException("sortBy", "must be addedAt or title");
        return sortBy;
    }

    private boolean validateDirection(String direction) {
        if (direction == null || "desc".equals(direction)) return false;
        if ("asc".equals(direction)) return true;
        throw new InvalidAudioRequestException("sortDirection", "must be asc or desc");
    }

    private List<Long> validateTagIds(Long accountId, List<Long> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) return List.of();
        List<Long> distinct = new LinkedHashSet<>(tagIds).stream().toList();
        if (tagRepository.findAllByAccount_IdAndIdIn(accountId, distinct).size() != distinct.size()) {
            throw new TagNotFoundException();
        }
        return distinct;
    }

    private List<TagResponse> tagsForAudio(Long audioId) {
        return libraryAudioTagRepository.findWithTagsByLibraryAudioIds(List.of(audioId)).stream()
                .map(relation -> TagResponse.from(relation.getTag())).toList();
    }

    private Map<Long, List<TagResponse>> tagsByAudioId(List<LibraryAudio> audio) {
        if (audio.isEmpty()) return Map.of();
        return libraryAudioTagRepository.findWithTagsByLibraryAudioIds(
                audio.stream().map(LibraryAudio::getId).toList()).stream()
                .collect(Collectors.groupingBy(relation -> relation.getLibraryAudio().getId(),
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
