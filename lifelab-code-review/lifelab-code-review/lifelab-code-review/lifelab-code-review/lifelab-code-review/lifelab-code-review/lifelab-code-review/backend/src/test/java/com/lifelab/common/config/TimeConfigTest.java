package com.lifelab.common.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.DateTimeException;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

class TimeConfigTest {

    private final TimeConfig config =
            new TimeConfig();

    @Test
    void clockUsesConfiguredDefaultTimeZone() {
        var clock =
                config.clock(
                        "Asia/Ho_Chi_Minh");

        assertThat(clock.getZone())
                .isEqualTo(
                        ZoneId.of(
                                "Asia/Ho_Chi_Minh"));
    }

    @Test
    void invalidDefaultTimeZoneFailsFast() {
        assertThatThrownBy(
                () -> config.clock(
                        "Mars/Olympus"))
                .isInstanceOf(
                        DateTimeException.class);
    }
}