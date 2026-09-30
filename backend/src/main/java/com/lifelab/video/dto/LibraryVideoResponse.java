package com.lifelab.video.dto;

import java.time.OffsetDateTime;
import java.util.List;

import com.lifelab.video.domain.LibraryVideo;

public record LibraryVideoResponse(
        Long id,
        YouTubeVideoResponse youtubeSource,
        String customTitle,
        String personalDescription,
        List<TagResponse> tags,
        OffsetDateTime addedAt,
        OffsetDateTime updatedAt,
        boolean watched,
        long viewCount,
        OffsetDateTime lastWatchedAt) {

    public static LibraryVideoResponse from(LibraryVideo libraryVideo) {
        return from(libraryVideo, List.of(), 0L, null);
    }

    public static LibraryVideoResponse from(
            LibraryVideo libraryVideo,
            long viewCount,
            OffsetDateTime lastWatchedAt) {
        return from(libraryVideo, List.of(), viewCount, lastWatchedAt);
    }

    public static LibraryVideoResponse from(
            LibraryVideo libraryVideo,
            List<TagResponse> tags,
            long viewCount,
            OffsetDateTime lastWatchedAt) {
        return new LibraryVideoResponse(
                libraryVideo.getId(),
                YouTubeVideoResponse.from(libraryVideo.getYoutubeSource()),
                libraryVideo.getCustomTitle(),
                libraryVideo.getPersonalDescription(),
                tags,
                libraryVideo.getAddedAt(),
                libraryVideo.getUpdatedAt(),
                viewCount > 0,
                viewCount,
                lastWatchedAt);
    }
}
