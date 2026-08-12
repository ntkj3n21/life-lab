package com.lifelab.watch.service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Objects;

import org.springframework.stereotype.Component;

@Component
public class WatchHeartbeatPolicy {

    public static final int HEARTBEAT_TOLERANCE_SECONDS = 2;

    public int calculateTrustedDelta(
            OffsetDateTime startedAt,
            OffsetDateTime lastHeartbeatAt,
            OffsetDateTime serverNow,
            int currentWatchTimeSeconds,
            int clientPlayedSecondsDelta) {
        Objects.requireNonNull(startedAt, "startedAt must not be null");
        Objects.requireNonNull(lastHeartbeatAt, "lastHeartbeatAt must not be null");
        Objects.requireNonNull(serverNow, "serverNow must not be null");
        if (currentWatchTimeSeconds < 0) {
            throw new IllegalArgumentException("currentWatchTimeSeconds must not be negative");
        }
        if (clientPlayedSecondsDelta < 0) {
            throw new IllegalArgumentException("clientPlayedSecondsDelta must not be negative");
        }

        long elapsedSinceHeartbeat = nonNegativeWholeSeconds(lastHeartbeatAt, serverNow);
        long elapsedSinceStart = nonNegativeWholeSeconds(startedAt, serverNow);
        long maxByHeartbeat = saturatedAdd(elapsedSinceHeartbeat, HEARTBEAT_TOLERANCE_SECONDS);
        long maxTotalBySession = saturatedAdd(elapsedSinceStart, HEARTBEAT_TOLERANCE_SECONDS);
        long remainingSessionAllowance = Math.max(
                0L,
                maxTotalBySession - (long) currentWatchTimeSeconds);
        long trustedDelta = Math.min(
                (long) clientPlayedSecondsDelta,
                Math.min(maxByHeartbeat, remainingSessionAllowance));
        return Math.toIntExact(trustedDelta);
    }

    private long nonNegativeWholeSeconds(OffsetDateTime from, OffsetDateTime to) {
        return Math.max(0L, Duration.between(from, to).getSeconds());
    }

    private long saturatedAdd(long value, int increment) {
        return value > Long.MAX_VALUE - increment
                ? Long.MAX_VALUE
                : value + increment;
    }
}
