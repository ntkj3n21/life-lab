package com.lifelab.watch.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;

class WatchHeartbeatPolicyTest {

    private static final OffsetDateTime STARTED_AT = OffsetDateTime.parse("2026-08-11T00:00:00Z");

    private final WatchHeartbeatPolicy policy = new WatchHeartbeatPolicy();

    @Test
    void acceptsNormalReportWithinServerElapsedTime() {
        assertThat(trusted(STARTED_AT, STARTED_AT.plusSeconds(10), 0, 10)).isEqualTo(10);
    }

    @Test
    void capsOverReportAtElapsedTimePlusTwoSecondTolerance() {
        assertThat(trusted(STARTED_AT, STARTED_AT.plusSeconds(10), 0, 100)).isEqualTo(12);
    }

    @Test
    void usesExactlyTwoSecondsOfTolerance() {
        assertThat(trusted(STARTED_AT, STARTED_AT, 0, 100)).isEqualTo(2);
    }

    @Test
    void zeroClientDeltaAlwaysRemainsZero() {
        assertThat(trusted(STARTED_AT, STARTED_AT.plusMinutes(1), 0, 0)).isZero();
    }

    @Test
    void delayedHeartbeatAcceptsSmallerLegitimateClientDelta() {
        assertThat(trusted(STARTED_AT, STARTED_AT.plusMinutes(5), 0, 17)).isEqualTo(17);
    }

    @Test
    void wholeSessionCapPreventsToleranceFromCompoundingAcrossHeartbeats() {
        OffsetDateTime firstNow = STARTED_AT.plusSeconds(10);
        int firstDelta = policy.calculateTrustedDelta(STARTED_AT, STARTED_AT, firstNow, 0, 100);
        int firstTotal = firstDelta;
        OffsetDateTime secondNow = STARTED_AT.plusSeconds(20);
        int secondDelta = policy.calculateTrustedDelta(
                STARTED_AT, firstNow, secondNow, firstTotal, 100);
        int secondTotal = firstTotal + secondDelta;

        assertThat(firstTotal).isEqualTo(12);
        assertThat(secondDelta).isEqualTo(10);
        assertThat(secondTotal).isEqualTo(22);
    }

    @Test
    void replayedLargeReportCannotRepeatedlyAddToleranceWithoutElapsedTime() {
        OffsetDateTime now = STARTED_AT.plusSeconds(10);
        int firstDelta = policy.calculateTrustedDelta(STARTED_AT, STARTED_AT, now, 0, 100);
        int replayDelta = policy.calculateTrustedDelta(STARTED_AT, now, now, firstDelta, 100);

        assertThat(firstDelta).isEqualTo(12);
        assertThat(replayDelta).isZero();
    }

    @Test
    void abnormalClockOrderingNeverCreatesNegativeAllowance() {
        OffsetDateTime future = STARTED_AT.plusMinutes(1);
        assertThat(policy.calculateTrustedDelta(future, future, STARTED_AT, 0, 10)).isEqualTo(2);
        assertThat(policy.calculateTrustedDelta(future, future, STARTED_AT, 2, 10)).isZero();
    }

    @Test
    void rejectsNegativeClientDeltaDefensively() {
        assertThatThrownBy(() -> trusted(STARTED_AT, STARTED_AT.plusSeconds(10), 0, -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("clientPlayedSecondsDelta must not be negative");
    }

    @Test
    void arithmeticRemainsSafeAtIntegerLimits() {
        OffsetDateTime farFuture = STARTED_AT.plusYears(100_000_000);
        assertThat(policy.calculateTrustedDelta(
                STARTED_AT,
                STARTED_AT,
                farFuture,
                Integer.MAX_VALUE - 1,
                Integer.MAX_VALUE))
                .isEqualTo(Integer.MAX_VALUE);
        assertThat(policy.calculateTrustedDelta(
                STARTED_AT,
                farFuture,
                farFuture,
                Integer.MAX_VALUE,
                Integer.MAX_VALUE))
                .isEqualTo(2);
    }

    private int trusted(
            OffsetDateTime lastHeartbeatAt,
            OffsetDateTime now,
            int currentWatchTimeSeconds,
            int clientPlayedSecondsDelta) {
        return policy.calculateTrustedDelta(
                STARTED_AT,
                lastHeartbeatAt,
                now,
                currentWatchTimeSeconds,
                clientPlayedSecondsDelta);
    }
}
