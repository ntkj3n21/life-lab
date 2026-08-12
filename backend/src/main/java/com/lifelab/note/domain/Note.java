package com.lifelab.note.domain;

import java.time.OffsetDateTime;

import com.lifelab.auth.domain.Account;
import com.lifelab.video.domain.YouTubeVideo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

@Entity
@Table(name = "notes")
public class Note {

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

    @NotBlank
    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @PositiveOrZero
    @Column(name = "timestamp_seconds")
    private Integer timestampSeconds;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Note() {
    }

    public static Note create(
            Account account,
            YouTubeVideo youtubeSource,
            String content,
            Integer timestampSeconds,
            OffsetDateTime now) {
        if (account == null) {
            throw new NullPointerException("account must not be null");
        }
        if (youtubeSource == null) {
            throw new NullPointerException("youtubeSource must not be null");
        }
        validateContent(content);
        if (timestampSeconds != null && timestampSeconds < 0) {
            throw new IllegalArgumentException("timestampSeconds must not be negative");
        }
        if (now == null) {
            throw new NullPointerException("now must not be null");
        }
        Note note = new Note();
        note.account = account;
        note.youtubeSource = youtubeSource;
        note.content = content;
        note.timestampSeconds = timestampSeconds;
        note.createdAt = now;
        note.updatedAt = now;
        return note;
    }

    public void updateContent(String content, OffsetDateTime now) {
        validateContent(content);
        if (now == null) {
            throw new NullPointerException("now must not be null");
        }
        this.content = content;
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

    public String getContent() {
        return content;
    }

    public Integer getTimestampSeconds() {
        return timestampSeconds;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    private static boolean isWhitespace(int codePoint) {
        return Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint);
    }

    private static void validateContent(String content) {
        if (content == null || content.codePoints().allMatch(Note::isWhitespace)) {
            throw new IllegalArgumentException("content must contain meaningful text");
        }
    }
}
