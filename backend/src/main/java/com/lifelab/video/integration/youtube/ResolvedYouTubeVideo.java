package com.lifelab.video.integration.youtube;

import java.time.OffsetDateTime;

import com.lifelab.video.domain.YouTubeAvailabilityStatus;

public record ResolvedYouTubeVideo(
        String youtubeVideoId,
        String sourceUrl,
        String title,
        String channelName,
        String thumbnailUrl,
        Integer durationSeconds,
        OffsetDateTime publishedAt,
        YouTubeAvailabilityStatus availabilityStatus) {
}
