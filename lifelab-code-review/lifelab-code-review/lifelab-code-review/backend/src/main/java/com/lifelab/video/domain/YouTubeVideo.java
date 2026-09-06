package com.lifelab.video.domain;

import java.time.OffsetDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

@Entity
@Table(
        name = "youtube_videos",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_youtube_videos_youtube_video_id",
                columnNames = "youtube_video_id"
        )
)
public class YouTubeVideo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(name = "youtube_video_id", nullable = false, columnDefinition = "varchar")
    private String youtubeVideoId;

    @NotBlank
    @Column(name = "source_url", nullable = false, columnDefinition = "text")
    private String sourceUrl;

    @Column(columnDefinition = "text")
    private String title;

    @Column(name = "channel_name", columnDefinition = "text")
    private String channelName;

    @Column(name = "thumbnail_url", columnDefinition = "text")
    private String thumbnailUrl;

    @PositiveOrZero
    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "published_at")
    private OffsetDateTime publishedAt;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "availability_status", nullable = false, columnDefinition = "varchar")
    private YouTubeAvailabilityStatus availabilityStatus;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected YouTubeVideo() {
    }

    public static YouTubeVideo create(
            String youtubeVideoId,
            String sourceUrl,
            String title,
            String channelName,
            String thumbnailUrl,
            Integer durationSeconds,
            OffsetDateTime publishedAt,
            YouTubeAvailabilityStatus availabilityStatus,
            OffsetDateTime now) {
        YouTubeVideo video = new YouTubeVideo();
        video.youtubeVideoId = youtubeVideoId;
        video.sourceUrl = sourceUrl;
        video.title = title;
        video.channelName = channelName;
        video.thumbnailUrl = thumbnailUrl;
        video.durationSeconds = durationSeconds;
        video.publishedAt = publishedAt;
        video.availabilityStatus = availabilityStatus;
        video.createdAt = now;
        video.updatedAt = now;
        return video;
    }

    public Long getId() {
        return id;
    }

    public String getYoutubeVideoId() {
        return youtubeVideoId;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public String getTitle() {
        return title;
    }

    public String getChannelName() {
        return channelName;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public OffsetDateTime getPublishedAt() {
        return publishedAt;
    }

    public YouTubeAvailabilityStatus getAvailabilityStatus() {
        return availabilityStatus;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
