package com.lifelab.watch.service;

import org.springframework.stereotype.Component;

import com.lifelab.watch.domain.WatchSessionValidityStatus;

@Component
public class WatchSessionValidityEvaluator {

    private static final int UNKNOWN_DURATION_THRESHOLD_SECONDS = 30;

    public WatchSessionValidityStatus evaluateActive(Integer durationSeconds, int watchTimeSeconds) {
        requireNonNegativeWatchTime(watchTimeSeconds);
        if (hasReachedValidThreshold(durationSeconds, watchTimeSeconds)) {
            return WatchSessionValidityStatus.VALID;
        }
        return WatchSessionValidityStatus.PENDING;
    }

    public WatchSessionValidityStatus evaluateClosed(Integer durationSeconds, int watchTimeSeconds) {
        requireNonNegativeWatchTime(watchTimeSeconds);
        if (hasReachedValidThreshold(durationSeconds, watchTimeSeconds)) {
            return WatchSessionValidityStatus.VALID;
        }
        return durationSeconds == null
                ? WatchSessionValidityStatus.UNDETERMINED
                : WatchSessionValidityStatus.INVALID;
    }

    private boolean hasReachedValidThreshold(Integer durationSeconds, int watchTimeSeconds) {
        int threshold = durationSeconds == null
                ? UNKNOWN_DURATION_THRESHOLD_SECONDS
                : knownDurationThreshold(durationSeconds);
        return watchTimeSeconds >= threshold;
    }

    private int knownDurationThreshold(int durationSeconds) {
        long eightyPercentCeiling = ((long) durationSeconds * 4 + 4) / 5;
        return (int) Math.min(UNKNOWN_DURATION_THRESHOLD_SECONDS, eightyPercentCeiling);
    }

    private void requireNonNegativeWatchTime(int watchTimeSeconds) {
        if (watchTimeSeconds < 0) {
            throw new IllegalArgumentException("watchTimeSeconds must not be negative");
        }
    }
}
