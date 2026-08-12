package com.lifelab.watch.service;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.exception.LibraryVideoNotFoundException;
import com.lifelab.video.repository.LibraryVideoRepository;
import com.lifelab.watch.domain.WatchSession;
import com.lifelab.watch.domain.WatchSessionValidityStatus;
import com.lifelab.watch.dto.WatchSessionHeartbeatRequest;
import com.lifelab.watch.dto.CloseWatchSessionRequest;
import com.lifelab.watch.dto.WatchSessionResponse;
import com.lifelab.watch.exception.WatchSessionClosedException;
import com.lifelab.watch.exception.WatchSessionNotFoundException;
import com.lifelab.watch.repository.WatchSessionRepository;

@Service
public class WatchSessionService {

    private final LibraryVideoRepository libraryVideoRepository;
    private final WatchSessionRepository watchSessionRepository;
    private final WatchSessionValidityEvaluator validityEvaluator;
    private final WatchHeartbeatPolicy heartbeatPolicy;
    private final Clock clock;

    public WatchSessionService(
            LibraryVideoRepository libraryVideoRepository,
            WatchSessionRepository watchSessionRepository,
            WatchSessionValidityEvaluator validityEvaluator,
            WatchHeartbeatPolicy heartbeatPolicy,
            Clock clock) {
        this.libraryVideoRepository = libraryVideoRepository;
        this.watchSessionRepository = watchSessionRepository;
        this.validityEvaluator = validityEvaluator;
        this.heartbeatPolicy = heartbeatPolicy;
        this.clock = clock;
    }

    @Transactional
    public WatchSessionResponse startSession(Long accountId, Long libraryVideoId) {
        LibraryVideo libraryVideo = libraryVideoRepository
                .findByIdAndAccount_Id(libraryVideoId, accountId)
                .orElseThrow(LibraryVideoNotFoundException::new);
        OffsetDateTime now = OffsetDateTime.now(clock);
        WatchSession session = WatchSession.start(libraryVideo, now);
        return WatchSessionResponse.from(watchSessionRepository.saveAndFlush(session));
    }

    @Transactional
    public WatchSessionResponse heartbeat(
            Long accountId,
            Long watchSessionId,
            WatchSessionHeartbeatRequest request) {
        WatchSession session = watchSessionRepository
                .findByIdAndLibraryVideo_Account_Id(watchSessionId, accountId)
                .orElseThrow(WatchSessionNotFoundException::new);
        if (session.getEndedAt() != null) {
            throw new WatchSessionClosedException();
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        int trustedDelta = heartbeatPolicy.calculateTrustedDelta(
                session.getStartedAt(),
                session.getLastHeartbeatAt(),
                now,
                session.getWatchTimeSeconds(),
                request.playedSecondsDelta());
        int newWatchTime = Math.addExact(session.getWatchTimeSeconds(), trustedDelta);
        Integer durationSeconds = session.getLibraryVideo().getYoutubeSource().getDurationSeconds();
        WatchSessionValidityStatus status = validityEvaluator.evaluateActive(durationSeconds, newWatchTime);
        session.applyHeartbeat(trustedDelta, now, status);
        return WatchSessionResponse.from(watchSessionRepository.saveAndFlush(session));
    }

    @Transactional
    public WatchSessionResponse closeSession(
            Long accountId,
            Long watchSessionId,
            CloseWatchSessionRequest request) {
        WatchSession session = watchSessionRepository
                .findByIdAndLibraryVideo_Account_Id(watchSessionId, accountId)
                .orElseThrow(WatchSessionNotFoundException::new);
        if (session.getEndedAt() != null) {
            throw new WatchSessionClosedException();
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        int trustedDelta = heartbeatPolicy.calculateTrustedDelta(
                session.getStartedAt(),
                session.getLastHeartbeatAt(),
                now,
                session.getWatchTimeSeconds(),
                request.playedSecondsDelta());
        int finalWatchTime = Math.addExact(session.getWatchTimeSeconds(), trustedDelta);
        Integer durationSeconds = session.getLibraryVideo().getYoutubeSource().getDurationSeconds();
        WatchSessionValidityStatus evaluatedStatus = validityEvaluator.evaluateClosed(
                durationSeconds,
                finalWatchTime);
        WatchSessionValidityStatus finalStatus = session.getValidityStatus()
                == WatchSessionValidityStatus.VALID
                        ? WatchSessionValidityStatus.VALID
                        : evaluatedStatus;
        session.close(trustedDelta, now, finalStatus);
        return WatchSessionResponse.from(watchSessionRepository.saveAndFlush(session));
    }
}
