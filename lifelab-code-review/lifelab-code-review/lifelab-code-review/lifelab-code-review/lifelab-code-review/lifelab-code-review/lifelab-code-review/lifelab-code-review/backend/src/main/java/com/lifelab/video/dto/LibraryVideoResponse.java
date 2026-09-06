package com.lifelab.video.dto;

import java.time.OffsetDateTime;

import com.lifelab.video.domain.LibraryVideo;

public record LibraryVideoResponse(
        Long id,
        YouTubeVideoResponse youtubeSource,
        String customTitle,
        String personalDescription,
        OffsetDateTime addedAt,
        OffsetDateTime updatedAt,
        boolean watched,
        long viewCount,
        OffsetDateTime lastWatchedAt) {

    public static LibraryVideoResponse from(LibraryVideo libraryVideo) {
        return from(libraryVideo, 0L, null);
    }

    public static LibraryVideoResponse from(
            LibraryVideo libraryVideo,
            long viewCount,
            OffsetDateTime lastWatchedAt) {
        return new LibraryVideoResponse(
                libraryVideo.getId(),
                YouTubeVideoResponse.from(libraryVideo.getYoutubeSource()),
                libraryVideo.getCustomTitle(),
                libraryVideo.getPersonalDescription(),
                libraryVideo.getAddedAt(),
                libraryVideo.getUpdatedAt(),
                viewCount > 0,
                viewCount,
                lastWatchedAt);
    }
}