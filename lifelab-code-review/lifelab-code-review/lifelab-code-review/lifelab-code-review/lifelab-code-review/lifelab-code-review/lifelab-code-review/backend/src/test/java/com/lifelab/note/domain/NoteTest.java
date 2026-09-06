package com.lifelab.note.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;

import com.lifelab.auth.domain.Account;
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;

class NoteTest {

    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-03-15T12:00:00Z");

    @Test
    void factoryAssignsSourceContentTimestampAndServerTimestamps() {
        Account account = account();
        YouTubeVideo source = source();

        Note note = Note.create(account, source, "Important context", 0, NOW);

        assertThat(note.getAccount()).isSameAs(account);
        assertThat(note.getYoutubeSource()).isSameAs(source);
        assertThat(note.getContent()).isEqualTo("Important context");
        assertThat(note.getTimestampSeconds()).isZero();
        assertThat(note.getCreatedAt()).isEqualTo(NOW);
        assertThat(note.getUpdatedAt()).isEqualTo(NOW);
    }

    @Test
    void factoryPreservesNullTimestamp() {
        Note note = Note.create(account(), source(), "Context", null, NOW);

        assertThat(note.getTimestampSeconds()).isNull();
    }

    @Test
    void factoryRejectsMissingRequiredAssociationsAndTime() {
        assertThatThrownBy(() -> Note.create(null, source(), "Context", 1, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> Note.create(account(), null, "Context", 1, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> Note.create(account(), source(), "Context", 1, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void factoryRejectsWhitespaceOnlyContentIncludingUnicodeWhitespace() {
        assertThatThrownBy(() -> Note.create(account(), source(), " \t\n", 1, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Note.create(account(), source(), "\u00A0", 1, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void factoryRejectsNegativeTimestamp() {
        assertThatThrownBy(() -> Note.create(account(), source(), "Context", -1, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updateContentChangesOnlyContentAndUpdatedAt() {
        Account account = account();
        YouTubeVideo source = source();
        Note note = Note.create(account, source, "Original", 12, NOW);
        OffsetDateTime later = NOW.plusHours(1);

        note.updateContent("Updated", later);

        assertThat(note.getContent()).isEqualTo("Updated");
        assertThat(note.getUpdatedAt()).isEqualTo(later);
        assertThat(note.getCreatedAt()).isEqualTo(NOW);
        assertThat(note.getAccount()).isSameAs(account);
        assertThat(note.getYoutubeSource()).isSameAs(source);
        assertThat(note.getTimestampSeconds()).isEqualTo(12);
    }

    @Test
    void updateContentRejectsWhitespaceAndMissingTimeWithoutMutation() {
        Note note = Note.create(account(), source(), "Original", 12, NOW);

        assertThatThrownBy(() -> note.updateContent("\u00A0", NOW.plusHours(1)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> note.updateContent("Updated", null))
                .isInstanceOf(NullPointerException.class);
        assertThat(note.getContent()).isEqualTo("Original");
        assertThat(note.getUpdatedAt()).isEqualTo(NOW);
    }

    private Account account() {
        return Account.create("user@example.com", "hash", "User", NOW);
    }

    private YouTubeVideo source() {
        return YouTubeVideo.create(
                "note-source",
                "https://www.youtube.com/watch?v=note-source",
                "Title",
                "Channel",
                null,
                100,
                NOW,
                YouTubeAvailabilityStatus.AVAILABLE,
                NOW);
    }
}
