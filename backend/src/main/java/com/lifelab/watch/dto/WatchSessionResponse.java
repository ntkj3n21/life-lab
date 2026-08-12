package com.lifelab.watch.dto;

import java.time.OffsetDateTime;

import com.lifelab.watch.domain.WatchSession;
import com.lifelab.watch.domain.WatchSessionValidityStatus;

public record WatchSessionResponse(
        Long id,
        Long libraryVideoId,
        OffsetDateTime startedAt,
        OffsetDateTime endedAt,
        OffsetDateTime lastHeartbeatAt,
        Integer watchTimeSeconds,
        WatchSessionValidityStatus validityStatus) {

    public static WatchSessionResponse from(WatchSession session) {
        return new WatchSessionResponse(
                session.getId(),
                session.getLibraryVideo().getId(),
                session.getStartedAt(),
                session.getEndedAt(),
                session.getLastHeartbeatAt(),
                session.getWatchTimeSeconds(),
                session.getValidityStatus());
    }
}
