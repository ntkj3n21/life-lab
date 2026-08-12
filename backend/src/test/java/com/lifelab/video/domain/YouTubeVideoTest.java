package com.lifelab.video.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;

class YouTubeVideoTest {

    @Test
    void factoryAssignsResolvedSourceFieldsAndTimestamps() {
        OffsetDateTime publishedAt = OffsetDateTime.parse("2024-04-15T09:30:00Z");
        OffsetDateTime now = OffsetDateTime.parse("2026-08-11T12:00:00Z");

        YouTubeVideo video = YouTubeVideo.create(
                "dQw4w9WgXcQ",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "Resolved title",
                "Resolved channel",
                "https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
                213,
                publishedAt,
                YouTubeAvailabilityStatus.AVAILABLE,
                now);

        assertThat(video.getId()).isNull();
        assertThat(video.getYoutubeVideoId()).isEqualTo("dQw4w9WgXcQ");
        assertThat(video.getSourceUrl()).isEqualTo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
        assertThat(video.getTitle()).isEqualTo("Resolved title");
        assertThat(video.getChannelName()).isEqualTo("Resolved channel");
        assertThat(video.getThumbnailUrl())
                .isEqualTo("https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg");
        assertThat(video.getDurationSeconds()).isEqualTo(213);
        assertThat(video.getPublishedAt()).isEqualTo(publishedAt);
        assertThat(video.getAvailabilityStatus()).isEqualTo(YouTubeAvailabilityStatus.AVAILABLE);
        assertThat(video.getCreatedAt()).isEqualTo(now);
        assertThat(video.getUpdatedAt()).isEqualTo(now);
    }

    @Test
    void factoryPreservesMissingOptionalMetadataAsNull() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-11T12:00:00Z");

        YouTubeVideo video = YouTubeVideo.create(
                "source-id",
                "https://youtu.be/source-id",
                null,
                null,
                null,
                null,
                null,
                YouTubeAvailabilityStatus.UNKNOWN,
                now);

        assertThat(video.getTitle()).isNull();
        assertThat(video.getChannelName()).isNull();
        assertThat(video.getThumbnailUrl()).isNull();
        assertThat(video.getDurationSeconds()).isNull();
        assertThat(video.getPublishedAt()).isNull();
        assertThat(video.getCreatedAt()).isEqualTo(now);
        assertThat(video.getUpdatedAt()).isEqualTo(now);
    }
}
