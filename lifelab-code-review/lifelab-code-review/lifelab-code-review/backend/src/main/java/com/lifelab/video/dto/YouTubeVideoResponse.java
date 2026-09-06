package com.lifelab.video.dto;

import java.time.OffsetDateTime;

import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;

public record YouTubeVideoResponse(
        Long id,
        String youtubeVideoId,
        String sourceUrl,
        String title,
        String channelName,
        String thumbnailUrl,
        Integer durationSeconds,
        OffsetDateTime publishedAt,
        YouTubeAvailabilityStatus availabilityStatus) {

    public static YouTubeVideoResponse from(YouTubeVideo video) {
        return new YouTubeVideoResponse(
                video.getId(),
                video.getYoutubeVideoId(),
                video.getSourceUrl(),
                video.getTitle(),
                video.getChannelName(),
                video.getThumbnailUrl(),
                video.getDurationSeconds(),
                video.getPublishedAt(),
                video.getAvailabilityStatus());
    }
}
