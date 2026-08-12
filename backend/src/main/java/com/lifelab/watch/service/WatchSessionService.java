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
import com.lifelab.watch.dto.CloseWatchSessionRequest;
import com.lifelab.watch.dto.WatchSessionHeartbeatRequest;
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

        WatchSession session = WatchSession.start(
                libraryVideo,
                OffsetDateTime.now(clock));

        return save(session);
    }

    @Transactional
    public WatchSessionResponse heartbeat(
            Long accountId,
            Long watchSessionId,
            WatchSessionHeartbeatRequest request) {
        WatchSession session = findOpenSession(accountId, watchSessionId);
        OffsetDateTime now = OffsetDateTime.now(clock);
        int trustedDelta = calculateTrustedDelta(
                session,
                now,
                request.playedSecondsDelta());

        int newWatchTime = watchTimeAfter(session, trustedDelta);
        WatchSessionValidityStatus status = validityEvaluator.evaluateActive(
                durationSeconds(session),
                newWatchTime);

        session.applyHeartbeat(
                trustedDelta,
                now,
                status);

        return save(session);
    }

    @Transactional
    public WatchSessionResponse closeSession(
            Long accountId,
            Long watchSessionId,
            CloseWatchSessionRequest request) {
        WatchSession session = findOpenSession(accountId, watchSessionId);
        OffsetDateTime now = OffsetDateTime.now(clock);
        int trustedDelta = calculateTrustedDelta(
                session,
                now,
                request.playedSecondsDelta());

        int finalWatchTime = watchTimeAfter(session, trustedDelta);
        WatchSessionValidityStatus evaluatedStatus = validityEvaluator.evaluateClosed(
                durationSeconds(session),
                finalWatchTime);

        WatchSessionValidityStatus finalStatus =
                session.getValidityStatus() == WatchSessionValidityStatus.VALID
                        ? WatchSessionValidityStatus.VALID
                        : evaluatedStatus;

        session.close(
                trustedDelta,
                now,
                finalStatus);

        return save(session);
    }

    private WatchSession findOpenSession(Long accountId, Long watchSessionId) {
        WatchSession session = watchSessionRepository
                .findByIdAndLibraryVideo_Account_Id(watchSessionId, accountId)
                .orElseThrow(WatchSessionNotFoundException::new);

        if (session.getEndedAt() != null) {
            throw new WatchSessionClosedException();
        }

        return session;
    }

    private int calculateTrustedDelta(
            WatchSession session,
            OffsetDateTime now,
            int playedSecondsDelta) {
        return heartbeatPolicy.calculateTrustedDelta(
                session.getStartedAt(),
                session.getLastHeartbeatAt(),
                now,
                session.getWatchTimeSeconds(),
                playedSecondsDelta);
    }

    private int watchTimeAfter(WatchSession session, int trustedDelta) {
        return Math.addExact(
                session.getWatchTimeSeconds(),
                trustedDelta);
    }

    private Integer durationSeconds(WatchSession session) {
        return session.getLibraryVideo()
                .getYoutubeSource()
                .getDurationSeconds();
    }

    private WatchSessionResponse save(WatchSession session) {
        return WatchSessionResponse.from(
                watchSessionRepository.saveAndFlush(session));
    }
}