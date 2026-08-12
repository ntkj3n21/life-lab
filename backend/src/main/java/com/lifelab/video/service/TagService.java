package com.lifelab.video.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.common.exception.UnauthenticatedException;
import com.lifelab.video.domain.Tag;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.domain.LibraryVideoTag;
import com.lifelab.video.dto.CreateTagRequest;
import com.lifelab.video.dto.RenameTagRequest;
import com.lifelab.video.dto.TagResponse;
import com.lifelab.video.dto.TagDeleteImpactResponse;
import com.lifelab.video.exception.TagAlreadyExistsException;
import com.lifelab.video.exception.TagNotFoundException;
import com.lifelab.video.exception.LibraryVideoNotFoundException;
import com.lifelab.video.repository.LibraryVideoRepository;
import com.lifelab.video.repository.LibraryVideoTagRepository;
import com.lifelab.video.repository.TagRepository;

@Service
public class TagService {

    private static final String TAG_NAME_UNIQUE_CONSTRAINT = "uk_tags_account_normalized_name";

    private final AccountRepository accountRepository;
    private final TagRepository tagRepository;
    private final LibraryVideoRepository libraryVideoRepository;
    private final LibraryVideoTagRepository libraryVideoTagRepository;
    private final TagNameNormalizer tagNameNormalizer;
    private final Clock clock;

    public TagService(
            AccountRepository accountRepository,
            TagRepository tagRepository,
            LibraryVideoRepository libraryVideoRepository,
            LibraryVideoTagRepository libraryVideoTagRepository,
            TagNameNormalizer tagNameNormalizer,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.tagRepository = tagRepository;
        this.libraryVideoRepository = libraryVideoRepository;
        this.libraryVideoTagRepository = libraryVideoTagRepository;
        this.tagNameNormalizer = tagNameNormalizer;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<TagResponse> getTags(Long accountId) {
        return tagRepository.findAllByAccount_IdOrderByNormalizedNameAscIdAsc(accountId)
                .stream()
                .map(TagResponse::from)
                .toList();
    }

    @Transactional
    public TagResponse createTag(Long accountId, CreateTagRequest request) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(UnauthenticatedException::new);
        NormalizedTagName normalized = normalize(request.name());
        if (tagRepository.findByAccount_IdAndNormalizedName(accountId, normalized.comparisonName()).isPresent()) {
            throw new TagAlreadyExistsException();
        }
        Tag tag = Tag.create(
                account,
                normalized.displayName(),
                normalized.comparisonName(),
                OffsetDateTime.now(clock));
        return save(tag);
    }

    @Transactional
    public TagResponse renameTag(Long accountId, Long tagId, RenameTagRequest request) {
        Tag tag = tagRepository.findByIdAndAccount_Id(tagId, accountId)
                .orElseThrow(TagNotFoundException::new);
        NormalizedTagName normalized = normalize(request.name());
        tagRepository.findByAccount_IdAndNormalizedName(accountId, normalized.comparisonName())
                .filter(existing -> !existing.getId().equals(tag.getId()))
                .ifPresent(existing -> {
                    throw new TagAlreadyExistsException();
                });
        tag.rename(
                normalized.displayName(),
                normalized.comparisonName(),
                OffsetDateTime.now(clock));
        return save(tag);
    }

    @Transactional(readOnly = true)
    public List<TagResponse> getVideoTags(Long accountId, Long libraryVideoId) {
        findOwnedLibraryVideo(accountId, libraryVideoId);
        return libraryVideoTagRepository
                .findAllByLibraryVideo_IdOrderByTag_NormalizedNameAscTag_IdAsc(libraryVideoId)
                .stream()
                .map(LibraryVideoTag::getTag)
                .map(TagResponse::from)
                .toList();
    }

    @Transactional
    public void attachTag(Long accountId, Long libraryVideoId, Long tagId) {
        LibraryVideo libraryVideo = findOwnedLibraryVideo(accountId, libraryVideoId);
        Tag tag = findOwnedTag(accountId, tagId);
        if (libraryVideoTagRepository.existsByLibraryVideo_IdAndTag_Id(libraryVideoId, tagId)) {
            return;
        }
        libraryVideoTagRepository.saveAndFlush(LibraryVideoTag.create(libraryVideo, tag));
    }

    @Transactional
    public void detachTag(Long accountId, Long libraryVideoId, Long tagId) {
        findOwnedLibraryVideo(accountId, libraryVideoId);
        findOwnedTag(accountId, tagId);
        if (!libraryVideoTagRepository.existsByLibraryVideo_IdAndTag_Id(libraryVideoId, tagId)) {
            return;
        }
        libraryVideoTagRepository.deleteByLibraryVideo_IdAndTag_Id(libraryVideoId, tagId);
        libraryVideoTagRepository.flush();
    }

    @Transactional(readOnly = true)
    public TagDeleteImpactResponse getDeleteImpact(Long accountId, Long tagId) {
        Tag tag = findOwnedTag(accountId, tagId);
        return new TagDeleteImpactResponse(
                tag.getId(),
                libraryVideoTagRepository.countByTag_Id(tag.getId()),
                true);
    }

    @Transactional
    public void deleteTag(Long accountId, Long tagId) {
        Tag tag = findOwnedTag(accountId, tagId);
        tagRepository.delete(tag);
        tagRepository.flush();
    }

    private LibraryVideo findOwnedLibraryVideo(Long accountId, Long libraryVideoId) {
        return libraryVideoRepository.findByIdAndAccount_Id(libraryVideoId, accountId)
                .orElseThrow(LibraryVideoNotFoundException::new);
    }

    private Tag findOwnedTag(Long accountId, Long tagId) {
        return tagRepository.findByIdAndAccount_Id(tagId, accountId)
                .orElseThrow(TagNotFoundException::new);
    }

    private NormalizedTagName normalize(String rawName) {
        String displayName = tagNameNormalizer.normalizeDisplayName(rawName);
        return new NormalizedTagName(
                displayName,
                tagNameNormalizer.normalizeForComparison(displayName));
    }

    private TagResponse save(Tag tag) {
        try {
            return TagResponse.from(tagRepository.saveAndFlush(tag));
        } catch (DataIntegrityViolationException exception) {
            if (isTagNameUniqueConstraintViolation(exception)) {
                throw new TagAlreadyExistsException();
            }
            throw exception;
        }
    }

    private boolean isTagNameUniqueConstraintViolation(DataIntegrityViolationException exception) {
        Throwable cause = exception;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException constraintViolation
                    && TAG_NAME_UNIQUE_CONSTRAINT.equalsIgnoreCase(
                            constraintViolation.getConstraintName())) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }

    private record NormalizedTagName(String displayName, String comparisonName) {
    }
}
