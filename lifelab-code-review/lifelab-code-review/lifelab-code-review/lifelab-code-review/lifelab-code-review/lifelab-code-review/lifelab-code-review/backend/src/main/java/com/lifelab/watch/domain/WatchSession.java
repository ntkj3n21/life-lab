package com.lifelab.watch.domain;

import java.time.OffsetDateTime;

import com.lifelab.video.domain.LibraryVideo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

@Entity
@Table(name = "watch_sessions")
public class WatchSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "library_video_id", nullable = false)
    private LibraryVideo libraryVideo;

    @NotNull
    @Column(name = "started_at", nullable = false)
    private OffsetDateTime startedAt;

    @Column(name = "ended_at")
    private OffsetDateTime endedAt;

    @NotNull
    @Column(name = "last_heartbeat_at", nullable = false)
    private OffsetDateTime lastHeartbeatAt;

    @NotNull
    @PositiveOrZero
    @Column(name = "watch_time_seconds", nullable = false)
    private Integer watchTimeSeconds;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "validity_status", nullable = false, columnDefinition = "varchar")
    private WatchSessionValidityStatus validityStatus;

    protected WatchSession() {
    }

    public static WatchSession start(LibraryVideo libraryVideo, OffsetDateTime now) {
        WatchSession watchSession = new WatchSession();
        watchSession.libraryVideo = libraryVideo;
        watchSession.startedAt = now;
        watchSession.endedAt = null;
        watchSession.lastHeartbeatAt = now;
        watchSession.watchTimeSeconds = 0;
        watchSession.validityStatus = WatchSessionValidityStatus.PENDING;
        return watchSession;
    }

    public void applyHeartbeat(
            int trustedPlayedSecondsDelta,
            OffsetDateTime now,
            WatchSessionValidityStatus evaluatedStatus) {
        if (trustedPlayedSecondsDelta < 0) {
            throw new IllegalArgumentException("trustedPlayedSecondsDelta must not be negative");
        }
        if (evaluatedStatus != WatchSessionValidityStatus.PENDING
                && evaluatedStatus != WatchSessionValidityStatus.VALID) {
            throw new IllegalArgumentException("Heartbeat status must be PENDING or VALID");
        }
        this.watchTimeSeconds = Math.addExact(this.watchTimeSeconds, trustedPlayedSecondsDelta);
        this.lastHeartbeatAt = now;
        this.validityStatus = evaluatedStatus;
    }

    public void close(
            int trustedPlayedSecondsDelta,
            OffsetDateTime now,
            WatchSessionValidityStatus finalStatus) {
        if (endedAt != null) {
            throw new IllegalStateException("Watch session is already closed");
        }
        if (trustedPlayedSecondsDelta < 0) {
            throw new IllegalArgumentException("trustedPlayedSecondsDelta must not be negative");
        }
        if (finalStatus != WatchSessionValidityStatus.VALID
                && finalStatus != WatchSessionValidityStatus.INVALID
                && finalStatus != WatchSessionValidityStatus.UNDETERMINED) {
            throw new IllegalArgumentException("Final status must be VALID, INVALID or UNDETERMINED");
        }
        this.watchTimeSeconds = Math.addExact(this.watchTimeSeconds, trustedPlayedSecondsDelta);
        this.lastHeartbeatAt = now;
        this.endedAt = now;
        this.validityStatus = finalStatus;
    }

    public Long getId() {
        return id;
    }

    public LibraryVideo getLibraryVideo() {
        return libraryVideo;
    }

    public OffsetDateTime getStartedAt() {
        return startedAt;
    }

    public OffsetDateTime getEndedAt() {
        return endedAt;
    }

    public OffsetDateTime getLastHeartbeatAt() {
        return lastHeartbeatAt;
    }

    public Integer getWatchTimeSeconds() {
        return watchTimeSeconds;
    }

    public WatchSessionValidityStatus getValidityStatus() {
        return validityStatus;
    }
}
