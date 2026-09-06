package com.lifelab.video.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;

import com.lifelab.auth.domain.Account;

class LibraryVideoTest {

    @Test
    void factoryCreatesPersonalLibraryEntryForAccountAndSharedSource() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-11T12:00:00Z");
        Account account = Account.create("user@example.com", "password-hash", "User", now);
        YouTubeVideo source = YouTubeVideo.create(
                "source-id",
                "https://youtu.be/source-id",
                null,
                null,
                null,
                null,
                null,
                YouTubeAvailabilityStatus.UNKNOWN,
                now);

        LibraryVideo libraryVideo = LibraryVideo.create(account, source, now);

        assertThat(libraryVideo.getId()).isNull();
        assertThat(libraryVideo.getAccount()).isSameAs(account);
        assertThat(libraryVideo.getYoutubeSource()).isSameAs(source);
        assertThat(libraryVideo.getCustomTitle()).isNull();
        assertThat(libraryVideo.getPersonalDescription()).isNull();
        assertThat(libraryVideo.getAddedAt()).isEqualTo(now);
        assertThat(libraryVideo.getUpdatedAt()).isEqualTo(now);
    }
}
