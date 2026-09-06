package com.lifelab.watch.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CloseWatchSessionRequest(
        @NotNull @PositiveOrZero Integer playedSecondsDelta) {
}
