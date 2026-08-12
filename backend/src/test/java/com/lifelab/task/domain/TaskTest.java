package com.lifelab.task.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;

import com.lifelab.auth.domain.Account;
import com.lifelab.note.domain.Note;
import com.lifelab.video.domain.YouTubeAvailabilityStatus;
import com.lifelab.video.domain.YouTubeVideo;

class TaskTest {

    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-08-12T01:00:00Z");

    @Test
    void independentFactoryAssignsBusinessFieldsAndInitialStatuses() {
        Account account = account();
        LocalDate deadline = LocalDate.of(2026, 8, 20);

        Task task = Task.createIndependent(account, "Review chapter", "Description", deadline, NOW);

        assertThat(task.getAccount()).isSameAs(account);
        assertThat(task.getTitle()).isEqualTo("Review chapter");
        assertThat(task.getDescription()).isEqualTo("Description");
        assertThat(task.getDeadline()).isEqualTo(deadline);
        assertThat(task.getSourceNote()).isNull();
        assertThat(task.getSourceStatus()).isEqualTo(TaskSourceStatus.INDEPENDENT);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.NOT_STARTED);
        assertThat(task.getCreatedAt()).isEqualTo(NOW);
        assertThat(task.getUpdatedAt()).isEqualTo(NOW);
    }

    @Test
    void independentFactoryAcceptsNullOptionalFieldsAndPastDeadline() {
        Task withoutOptional = Task.createIndependent(account(), "Task", null, null, NOW);
        Task pastDeadline = Task.createIndependent(
                account(), "Past task", null, LocalDate.of(2000, 1, 1), NOW);

        assertThat(withoutOptional.getDescription()).isNull();
        assertThat(withoutOptional.getDeadline()).isNull();
        assertThat(pastDeadline.getDeadline()).isEqualTo(LocalDate.of(2000, 1, 1));
    }

    @Test
    void independentFactoryRejectsMissingAccountAndServerTime() {
        assertThatThrownBy(() -> Task.createIndependent(null, "Task", null, null, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> Task.createIndependent(account(), "Task", null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void independentFactoryRejectsBlankAndUnicodeWhitespaceTitle() {
        assertThatThrownBy(() -> Task.createIndependent(account(), "   \t", null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Task.createIndependent(account(), "\u00A0\u2003", null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void independentFactoryRejectsTitleLongerThan255Characters() {
        assertThatThrownBy(() -> Task.createIndependent(account(), "a".repeat(256), null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void noteFactoryRetainsExactSourceAndDerivesAccount() {
        Account account = account();
        YouTubeVideo source = YouTubeVideo.create(
                "source", "https://youtube.example/source", null, null, null,
                null, null, YouTubeAvailabilityStatus.AVAILABLE, NOW);
        Note note = Note.create(account, source, "Context", 12, NOW);
        LocalDate deadline = LocalDate.of(2020, 1, 1);

        Task task = Task.createFromNote(note, "Review concept", null, deadline, NOW);

        assertThat(task.getAccount()).isSameAs(account);
        assertThat(task.getSourceNote()).isSameAs(note);
        assertThat(task.getSourceStatus()).isEqualTo(TaskSourceStatus.HAS_SOURCE);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.NOT_STARTED);
        assertThat(task.getTitle()).isEqualTo("Review concept");
        assertThat(task.getDescription()).isNull();
        assertThat(task.getDeadline()).isEqualTo(deadline);
        assertThat(task.getCreatedAt()).isEqualTo(NOW);
        assertThat(task.getUpdatedAt()).isEqualTo(NOW);
    }

    @Test
    void noteFactoryUsesIndependentTitleValidationAndRequiresSourceAndTime() {
        Note note = Note.create(account(), YouTubeVideo.create(
                "source", "https://youtube.example/source", null, null, null,
                null, null, YouTubeAvailabilityStatus.AVAILABLE, NOW), "Context", null, NOW);

        assertThatThrownBy(() -> Task.createFromNote(null, "Task", null, null, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> Task.createFromNote(note, "\u00A0\u2003", null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Task.createFromNote(note, "a".repeat(256), null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> Task.createFromNote(note, "Task", null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void updateDetailsChangesOnlyEditableFieldsAndTimestamp() {
        Account account = account();
        Task task = Task.createIndependent(
                account, "Original", "Description", LocalDate.of(2026, 8, 20), NOW);
        OffsetDateTime updatedAt = NOW.plusHours(1);

        task.updateDetails("Updated", null, LocalDate.of(2000, 1, 1), updatedAt);

        assertThat(task.getTitle()).isEqualTo("Updated");
        assertThat(task.getDescription()).isNull();
        assertThat(task.getDeadline()).isEqualTo(LocalDate.of(2000, 1, 1));
        assertThat(task.getUpdatedAt()).isEqualTo(updatedAt);
        assertThat(task.getCreatedAt()).isEqualTo(NOW);
        assertThat(task.getAccount()).isSameAs(account);
        assertThat(task.getSourceStatus()).isEqualTo(TaskSourceStatus.INDEPENDENT);
        assertThat(task.getSourceNote()).isNull();
        assertThat(task.getStatus()).isEqualTo(TaskStatus.NOT_STARTED);
    }

    @Test
    void updateDetailsUsesCreationTitleValidationAndAcceptsNullDeadline() {
        Task task = Task.createIndependent(account(), "Original", null, null, NOW);

        task.updateDetails("Updated", null, null, NOW.plusMinutes(1));

        assertThat(task.getDeadline()).isNull();
        assertThatThrownBy(() -> task.updateDetails("\u00A0\u2003", null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> task.updateDetails("a".repeat(256), null, null, NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> task.updateDetails("Valid", null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void changeStatusAllowsDirectTransitionsAndChangesOnlyStatusAndTimestamp() {
        Account account = account();
        Task task = Task.createIndependent(
                account, "Task", "Description", LocalDate.of(2026, 8, 20), NOW);
        OffsetDateTime firstUpdate = NOW.plusMinutes(1);
        OffsetDateTime secondUpdate = NOW.plusMinutes(2);

        task.changeStatus(TaskStatus.COMPLETED, firstUpdate);
        assertThat(task.getStatus()).isEqualTo(TaskStatus.COMPLETED);
        task.changeStatus(TaskStatus.IN_PROGRESS, secondUpdate);

        assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
        assertThat(task.getUpdatedAt()).isEqualTo(secondUpdate);
        assertThat(task.getTitle()).isEqualTo("Task");
        assertThat(task.getDescription()).isEqualTo("Description");
        assertThat(task.getDeadline()).isEqualTo(LocalDate.of(2026, 8, 20));
        assertThat(task.getCreatedAt()).isEqualTo(NOW);
        assertThat(task.getAccount()).isSameAs(account);
        assertThat(task.getSourceStatus()).isEqualTo(TaskSourceStatus.INDEPENDENT);
    }

    @Test
    void changeStatusRejectsMissingStatusOrTime() {
        Task task = Task.createIndependent(account(), "Task", null, null, NOW);

        assertThatThrownBy(() -> task.changeStatus(null, NOW))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> task.changeStatus(TaskStatus.COMPLETED, null))
                .isInstanceOf(NullPointerException.class);
    }

    private Account account() {
        return Account.create("user@example.com", "hash", "User", NOW);
    }
}
