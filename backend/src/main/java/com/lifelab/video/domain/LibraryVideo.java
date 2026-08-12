package com.lifelab.video.domain;

import java.time.OffsetDateTime;

import com.lifelab.auth.domain.Account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Entity
@Table(
        name = "library_videos",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_library_videos_account_youtube_source",
                columnNames = {"account_id", "youtube_source_id"}
        )
)
public class LibraryVideo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "youtube_source_id", nullable = false)
    private YouTubeVideo youtubeSource;

    @Size(max = 255)
    @Column(name = "custom_title")
    private String customTitle;

    @Column(name = "personal_description", columnDefinition = "text")
    private String personalDescription;

    @NotNull
    @Column(name = "added_at", nullable = false)
    private OffsetDateTime addedAt;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected LibraryVideo() {
    }

    public static LibraryVideo create(Account account, YouTubeVideo youtubeSource, OffsetDateTime now) {
        LibraryVideo libraryVideo = new LibraryVideo();
        libraryVideo.account = account;
        libraryVideo.youtubeSource = youtubeSource;
        libraryVideo.customTitle = null;
        libraryVideo.personalDescription = null;
        libraryVideo.addedAt = now;
        libraryVideo.updatedAt = now;
        return libraryVideo;
    }

    public void updatePersonalInfo(
            String customTitle,
            String personalDescription,
            OffsetDateTime now) {
        this.customTitle = customTitle;
        this.personalDescription = personalDescription;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public YouTubeVideo getYoutubeSource() {
        return youtubeSource;
    }

    public String getCustomTitle() {
        return customTitle;
    }

    public String getPersonalDescription() {
        return personalDescription;
    }

    public OffsetDateTime getAddedAt() {
        return addedAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
