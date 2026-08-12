package com.lifelab.watch.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.lifelab.watch.domain.WatchSessionValidityStatus;

class WatchSessionValidityEvaluatorTest {

    private final WatchSessionValidityEvaluator evaluator = new WatchSessionValidityEvaluator();

    @Test
    void evaluatesTenSecondDurationAtExactEightyPercentBoundary() {
        assertThat(evaluator.evaluateActive(10, 7)).isEqualTo(WatchSessionValidityStatus.PENDING);
        assertThat(evaluator.evaluateClosed(10, 7)).isEqualTo(WatchSessionValidityStatus.INVALID);
        assertThat(evaluator.evaluateActive(10, 8)).isEqualTo(WatchSessionValidityStatus.VALID);
        assertThat(evaluator.evaluateClosed(10, 8)).isEqualTo(WatchSessionValidityStatus.VALID);
    }

    @Test
    void evaluatesTwentySecondDurationAtExactEightyPercentBoundary() {
        assertThat(evaluator.evaluateClosed(20, 15)).isEqualTo(WatchSessionValidityStatus.INVALID);
        assertThat(evaluator.evaluateClosed(20, 16)).isEqualTo(WatchSessionValidityStatus.VALID);
    }

    @Test
    void evaluatesThirtySecondDurationAtExactEightyPercentBoundary() {
        assertThat(evaluator.evaluateClosed(30, 23)).isEqualTo(WatchSessionValidityStatus.INVALID);
        assertThat(evaluator.evaluateClosed(30, 24)).isEqualTo(WatchSessionValidityStatus.VALID);
    }

    @Test
    void capsKnownDurationThresholdAtThirtySeconds() {
        assertThat(evaluator.evaluateClosed(60, 29)).isEqualTo(WatchSessionValidityStatus.INVALID);
        assertThat(evaluator.evaluateClosed(60, 30)).isEqualTo(WatchSessionValidityStatus.VALID);
    }

    @Test
    void distinguishesActiveAndClosedSessionsWhenDurationIsUnknownBelowThreshold() {
        assertThat(evaluator.evaluateActive(null, 29)).isEqualTo(WatchSessionValidityStatus.PENDING);
        assertThat(evaluator.evaluateClosed(null, 29)).isEqualTo(WatchSessionValidityStatus.UNDETERMINED);
    }

    @Test
    void unknownDurationBecomesValidAtThirtySeconds() {
        assertThat(evaluator.evaluateActive(null, 30)).isEqualTo(WatchSessionValidityStatus.VALID);
        assertThat(evaluator.evaluateClosed(null, 30)).isEqualTo(WatchSessionValidityStatus.VALID);
    }

    @Test
    void roundsEightyPercentUpUsingExactIntegerArithmetic() {
        assertThat(evaluator.evaluateClosed(1, 0)).isEqualTo(WatchSessionValidityStatus.INVALID);
        assertThat(evaluator.evaluateClosed(1, 1)).isEqualTo(WatchSessionValidityStatus.VALID);
        assertThat(evaluator.evaluateClosed(6, 4)).isEqualTo(WatchSessionValidityStatus.INVALID);
        assertThat(evaluator.evaluateClosed(6, 5)).isEqualTo(WatchSessionValidityStatus.VALID);
        assertThat(evaluator.evaluateClosed(Integer.MAX_VALUE, 29))
                .isEqualTo(WatchSessionValidityStatus.INVALID);
        assertThat(evaluator.evaluateClosed(Integer.MAX_VALUE, 30))
                .isEqualTo(WatchSessionValidityStatus.VALID);
    }

    @Test
    void rejectsNegativeWatchTimeForActiveAndClosedEvaluation() {
        assertThatThrownBy(() -> evaluator.evaluateActive(60, -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("watchTimeSeconds must not be negative");
        assertThatThrownBy(() -> evaluator.evaluateClosed(null, -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("watchTimeSeconds must not be negative");
    }
}
