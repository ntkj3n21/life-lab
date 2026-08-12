package com.lifelab.video.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.exception.UnauthenticatedException;
import com.lifelab.common.persistence.DatabaseConstraintMatcher;
import com.lifelab.common.text.SearchKeywordNormalizer;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.task.repository.TaskRepository;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.domain.YouTubeVideo;
import com.lifelab.video.dto.AddLibraryVideoRequest;
import com.lifelab.video.dto.LibraryVideoDeleteImpactResponse;
import com.lifelab.video.dto.LibraryVideoResponse;
import com.lifelab.video.dto.UpdateLibraryVideoRequest;
import com.lifelab.video.exception.LibraryVideoAlreadyExistsException;
import com.lifelab.video.exception.LibraryVideoNotFoundException;
import com.lifelab.video.exception.TagNotFoundException;
import com.lifelab.video.integration.youtube.ResolvedYouTubeVideo;
import com.lifelab.video.integration.youtube.YouTubeMetadataClient;
import com.lifelab.video.integration.youtube.YouTubeUrlParser;
import com.lifelab.video.repository.LibraryVideoRepository;
import com.lifelab.video.repository.LibraryVideoSpecifications;
import com.lifelab.video.repository.LibraryVideoTagRepository;
import com.lifelab.video.repository.TagRepository;
import com.lifelab.video.repository.YouTubeVideoRepository;
import com.lifelab.watch.repository.LibraryVideoWatchStatsProjection;
import com.lifelab.watch.repository.WatchSessionRepository;

@Service
public class LibraryVideoService {

    private static final String LIBRARY_VIDEO_UNIQUE_CONSTRAINT =
            "uk_library_videos_account_youtube_source";

    private final AccountRepository accountRepository;
    private final YouTubeUrlParser youTubeUrlParser;
    private final YouTubeMetadataClient youTubeMetadataClient;
    private final YouTubeVideoRepository youTubeVideoRepository;
    private final LibraryVideoRepository libraryVideoRepository;
    private final LibraryVideoTagRepository libraryVideoTagRepository;
    private final WatchSessionRepository watchSessionRepository;
    private final NoteRepository noteRepository;
    private final TaskRepository taskRepository;
    private final TagRepository tagRepository;
    private final Clock clock;

    public LibraryVideoService(
            AccountRepository accountRepository,
            YouTubeUrlParser youTubeUrlParser,
            YouTubeMetadataClient youTubeMetadataClient,
            YouTubeVideoRepository youTubeVideoRepository,
            LibraryVideoRepository libraryVideoRepository,
            LibraryVideoTagRepository libraryVideoTagRepository,
            WatchSessionRepository watchSessionRepository,
            NoteRepository noteRepository,
            TaskRepository taskRepository,
            TagRepository tagRepository,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.youTubeUrlParser = youTubeUrlParser;
        this.youTubeMetadataClient = youTubeMetadataClient;
        this.youTubeVideoRepository = youTubeVideoRepository;
        this.libraryVideoRepository = libraryVideoRepository;
        this.libraryVideoTagRepository = libraryVideoTagRepository;
        this.watchSessionRepository = watchSessionRepository;
        this.noteRepository = noteRepository;
        this.taskRepository = taskRepository;
        this.tagRepository = tagRepository;
        this.clock = clock;
    }

    @Transactional
    public LibraryVideoResponse addVideo(Long accountId, AddLibraryVideoRequest request) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(UnauthenticatedException::new);

        String parsedVideoId =
                youTubeUrlParser.parse(request.youtubeUrl());

        ResolvedYouTubeVideo resolved =
                youTubeMetadataClient.resolve(parsedVideoId);

        OffsetDateTime now =
                OffsetDateTime.now(clock);

        YouTubeVideo youtubeSource = youTubeVideoRepository
                .findByYoutubeVideoId(resolved.youtubeVideoId())
                .orElseGet(() -> createSource(resolved, now));

        if (libraryVideoRepository.existsByAccount_IdAndYoutubeSource_Id(
                accountId,
                youtubeSource.getId())) {
            throw new LibraryVideoAlreadyExistsException();
        }

        LibraryVideo libraryVideo =
                LibraryVideo.create(account, youtubeSource, now);

        try {
            /*
             * A newly created Library entry cannot have a
             * WatchSession yet, so the zero-stat response is exact.
             */
            return LibraryVideoResponse.from(
                    libraryVideoRepository.saveAndFlush(libraryVideo));
        } catch (DataIntegrityViolationException exception) {
            if (DatabaseConstraintMatcher.matches(
                    exception,
                    LIBRARY_VIDEO_UNIQUE_CONSTRAINT)) {
                throw new LibraryVideoAlreadyExistsException();
            }

            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public PagedResponse<LibraryVideoResponse> getLibrary(
            Long accountId,
            int page,
            int size,
            String query,
            Integer minDurationSeconds,
            Integer maxDurationSeconds,
            LocalDate publishedFrom,
            LocalDate publishedTo,
            LocalDate addedFrom,
            LocalDate addedTo,
            List<Long> tagIds,
            Boolean watched,
            Boolean hasNotes,
            String sortBy,
            String sortDirection) {
        PageRequest pageRequest =
                PageRequest.of(page, size);

        String keyword =
                SearchKeywordNormalizer.normalize(query);

        List<Long> validatedTagIds =
                validateTagIds(accountId, tagIds);

        Specification<LibraryVideo> specification =
                LibraryVideoSpecifications.ownedBy(accountId);

        if (keyword != null) {
            specification = specification.and(
                    LibraryVideoSpecifications.keywordContains(keyword));
        }

        if (minDurationSeconds != null || maxDurationSeconds != null) {
            specification = specification.and(
                    LibraryVideoSpecifications.durationBetween(
                            minDurationSeconds,
                            maxDurationSeconds));
        }

        if (publishedFrom != null || publishedTo != null) {
            specification = specification.and(
                    LibraryVideoSpecifications.publishedBetween(
                            publishedFrom,
                            publishedTo));
        }

        if (addedFrom != null || addedTo != null) {
            specification = specification.and(
                    LibraryVideoSpecifications.addedBetween(
                            addedFrom,
                            addedTo));
        }

        if (!validatedTagIds.isEmpty()) {
            specification = specification.and(
                    LibraryVideoSpecifications.hasAnyTagId(validatedTagIds));
        }

        if (watched != null) {
            specification = specification.and(
                    LibraryVideoSpecifications.watched(watched));
        }

        if (hasNotes != null) {
            specification = specification.and(
                    LibraryVideoSpecifications.hasNotes(
                            accountId,
                            hasNotes));
        }

        specification = specification.and(
                LibraryVideoSpecifications.orderedBy(
                        sortBy,
                        "asc".equals(sortDirection)));

        Page<LibraryVideo> videos =
                libraryVideoRepository.findAll(specification, pageRequest);

        Map<Long, LibraryVideoWatchStatsProjection> watchStats =
                loadWatchStats(accountId, videos.getContent());

        Page<LibraryVideoResponse> result =
                videos.map(video -> toResponse(video, watchStats.get(video.getId())));

        return PagedResponse.from(result);
    }

    @Transactional(readOnly = true)
    public LibraryVideoResponse getVideo(Long accountId, Long libraryVideoId) {
        LibraryVideo video =
                findOwnedVideo(accountId, libraryVideoId);

        return toResponse(
                video,
                loadWatchStats(accountId, List.of(video)).get(video.getId()));
    }

    @Transactional
    public LibraryVideoResponse updateVideo(
            Long accountId,
            Long libraryVideoId,
            UpdateLibraryVideoRequest request) {
        LibraryVideo libraryVideo =
                findOwnedVideo(accountId, libraryVideoId);

        libraryVideo.updatePersonalInfo(
                request.customTitle(),
                request.personalDescription(),
                OffsetDateTime.now(clock));

        return toResponse(
                libraryVideo,
                loadWatchStats(accountId, List.of(libraryVideo)).get(libraryVideo.getId()));
    }

    @Transactional(readOnly = true)
    public LibraryVideoDeleteImpactResponse getDeleteImpact(
            Long accountId,
            Long libraryVideoId) {
        LibraryVideo libraryVideo =
                findOwnedVideo(accountId, libraryVideoId);

        Long youtubeSourceId =
                libraryVideo.getYoutubeSource().getId();

        return new LibraryVideoDeleteImpactResponse(
                libraryVideoId,
                watchSessionRepository.countByLibraryVideo_Id(libraryVideoId),
                libraryVideoTagRepository.countByLibraryVideo_Id(libraryVideoId),
                noteRepository.countByAccount_IdAndYoutubeSource_Id(
                        accountId,
                        youtubeSourceId),
                taskRepository.countByAccount_IdAndSourceNote_YoutubeSource_Id(
                        accountId,
                        youtubeSourceId),
                true);
    }

    @Transactional
    public void deleteVideo(Long accountId, Long libraryVideoId) {
        LibraryVideo libraryVideo =
                findOwnedVideo(accountId, libraryVideoId);

        libraryVideoRepository.delete(libraryVideo);
        libraryVideoRepository.flush();
    }

    private Map<Long, LibraryVideoWatchStatsProjection> loadWatchStats(
            Long accountId,
            List<LibraryVideo> videos) {
        if (videos.isEmpty()) {
            return Map.of();
        }

        List<Long> libraryVideoIds = videos.stream()
                .map(LibraryVideo::getId)
                .toList();

        /*
         * One grouped query enriches the whole current page.
         * This avoids one WatchSession query per Library card.
         */
        return watchSessionRepository
                .findValidStatsByAccountIdAndLibraryVideoIds(
                        accountId,
                        libraryVideoIds)
                .stream()
                .collect(Collectors.toMap(
                        LibraryVideoWatchStatsProjection::getLibraryVideoId,
                        stats -> stats));
    }

    private LibraryVideoResponse toResponse(
            LibraryVideo video,
            LibraryVideoWatchStatsProjection stats) {
        if (stats == null) {
            return LibraryVideoResponse.from(video);
        }

        long viewCount =
                stats.getViewCount() == null
                        ? 0L
                        : stats.getViewCount();

        return LibraryVideoResponse.from(
                video,
                viewCount,
                stats.getLastWatchedAt());
    }

    private LibraryVideo findOwnedVideo(Long accountId, Long libraryVideoId) {
        return libraryVideoRepository.findByIdAndAccount_Id(
                        libraryVideoId,
                        accountId)
                .orElseThrow(LibraryVideoNotFoundException::new);
    }

    private List<Long> validateTagIds(Long accountId, List<Long> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return List.of();
        }

        List<Long> distinctTagIds =
                new LinkedHashSet<>(tagIds).stream().toList();

        for (Long tagId : distinctTagIds) {
            tagRepository.findByIdAndAccount_Id(tagId, accountId)
                    .orElseThrow(TagNotFoundException::new);
        }

        return distinctTagIds;
    }

    private YouTubeVideo createSource(
            ResolvedYouTubeVideo resolved,
            OffsetDateTime now) {
        YouTubeVideo source = YouTubeVideo.create(
                resolved.youtubeVideoId(),
                resolved.sourceUrl(),
                resolved.title(),
                resolved.channelName(),
                resolved.thumbnailUrl(),
                resolved.durationSeconds(),
                resolved.publishedAt(),
                resolved.availabilityStatus(),
                now);

        return youTubeVideoRepository.saveAndFlush(source);
    }
}