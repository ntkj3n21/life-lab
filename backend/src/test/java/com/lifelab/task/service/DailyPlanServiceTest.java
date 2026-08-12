package com.lifelab.task.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.lifelab.auth.domain.Account;
import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskStatus;
import com.lifelab.task.dto.DailyPlanResponse;
import com.lifelab.task.exception.InvalidTaskFilterException;
import com.lifelab.task.repository.TaskRepository;

class DailyPlanServiceTest {

    private static final Long ACCOUNT_ID = 7L;
    private static final Instant INSTANT =
            Instant.parse("2026-08-12T00:30:00Z");

    @Test
    void emptyAccountReturnsFiveEmptyGroups() {
        TaskRepository repository = mock(TaskRepository.class);
        Clock clock = Clock.fixed(INSTANT, ZoneOffset.UTC);

        when(repository.findAllByAccount_IdOrderByCreatedAtDescIdDesc(ACCOUNT_ID))
                .thenReturn(List.of());

        DailyPlanService service = new DailyPlanService(repository, clock);

        DailyPlanResponse response =
                service.getDailyPlan(ACCOUNT_ID, "Asia/Ho_Chi_Minh");

        assertThat(response.currentDate()).isEqualTo(LocalDate.of(2026, 8, 12));
        assertThat(response.timeZone()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(response.overdue()).isEmpty();
        assertThat(response.today()).isEmpty();
        assertThat(response.upcoming()).isEmpty();
        assertThat(response.noDeadline()).isEmpty();
        assertThat(response.completed()).isEmpty();

        verify(repository)
                .findAllByAccount_IdOrderByCreatedAtDescIdDesc(ACCOUNT_ID);
    }

    @Test
    void classifiesEveryTaskExactlyOnceWithCompletedPriority() {
        TaskRepository repository = mock(TaskRepository.class);
        Clock clock = Clock.fixed(INSTANT, ZoneOffset.UTC);
        Account account = account();

        Task overdue = task(
                account,
                "Overdue",
                TaskStatus.NOT_STARTED,
                LocalDate.of(2026, 8, 11));

        Task today = task(
                account,
                "Today",
                TaskStatus.IN_PROGRESS,
                LocalDate.of(2026, 8, 12));

        Task upcoming = task(
                account,
                "Upcoming",
                TaskStatus.NOT_STARTED,
                LocalDate.of(2026, 8, 13));

        Task noDeadline = task(
                account,
                "No deadline",
                TaskStatus.IN_PROGRESS,
                null);

        Task completedPast = task(
                account,
                "Completed past",
                TaskStatus.COMPLETED,
                LocalDate.of(2026, 8, 1));

        Task completedToday = task(
                account,
                "Completed today",
                TaskStatus.COMPLETED,
                LocalDate.of(2026, 8, 12));

        Task completedFuture = task(
                account,
                "Completed future",
                TaskStatus.COMPLETED,
                LocalDate.of(2026, 8, 20));

        Task completedNoDeadline = task(
                account,
                "Completed no deadline",
                TaskStatus.COMPLETED,
                null);

        when(repository.findAllByAccount_IdOrderByCreatedAtDescIdDesc(ACCOUNT_ID))
                .thenReturn(List.of(
                        overdue,
                        today,
                        upcoming,
                        noDeadline,
                        completedPast,
                        completedToday,
                        completedFuture,
                        completedNoDeadline));

        DailyPlanService service = new DailyPlanService(repository, clock);

        DailyPlanResponse response =
                service.getDailyPlan(ACCOUNT_ID, "UTC");

        assertThat(response.overdue())
                .extracting(task -> task.title())
                .containsExactly("Overdue");

        assertThat(response.today())
                .extracting(task -> task.title())
                .containsExactly("Today");

        assertThat(response.upcoming())
                .extracting(task -> task.title())
                .containsExactly("Upcoming");

        assertThat(response.noDeadline())
                .extracting(task -> task.title())
                .containsExactly("No deadline");

        assertThat(response.completed())
                .extracting(task -> task.title())
                .containsExactly(
                        "Completed past",
                        "Completed today",
                        "Completed future",
                        "Completed no deadline");

        int total =
                response.overdue().size()
                        + response.today().size()
                        + response.upcoming().size()
                        + response.noDeadline().size()
                        + response.completed().size();

        assertThat(total).isEqualTo(8);
    }

    @Test
    void timezoneChangesCurrentDateAndThereforeClassification() {
        TaskRepository repository = mock(TaskRepository.class);
        Clock clock = Clock.fixed(INSTANT, ZoneOffset.UTC);
        Account account = account();

        Task task = task(
                account,
                "Boundary task",
                TaskStatus.NOT_STARTED,
                LocalDate.of(2026, 8, 11));

        when(repository.findAllByAccount_IdOrderByCreatedAtDescIdDesc(ACCOUNT_ID))
                .thenReturn(List.of(task));

        DailyPlanService service = new DailyPlanService(repository, clock);

        DailyPlanResponse vietnam =
                service.getDailyPlan(ACCOUNT_ID, "Asia/Ho_Chi_Minh");

        DailyPlanResponse losAngeles =
                service.getDailyPlan(ACCOUNT_ID, "America/Los_Angeles");

        assertThat(vietnam.currentDate())
                .isEqualTo(LocalDate.of(2026, 8, 12));
        assertThat(vietnam.overdue())
                .extracting(item -> item.title())
                .containsExactly("Boundary task");

        assertThat(losAngeles.currentDate())
                .isEqualTo(LocalDate.of(2026, 8, 11));
        assertThat(losAngeles.today())
                .extracting(item -> item.title())
                .containsExactly("Boundary task");
    }

    @Test
    void absentTimezoneUsesClockZone() {
        TaskRepository repository = mock(TaskRepository.class);
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        Clock clock = Clock.fixed(INSTANT, zone);

        when(repository.findAllByAccount_IdOrderByCreatedAtDescIdDesc(ACCOUNT_ID))
                .thenReturn(List.of());

        DailyPlanService service = new DailyPlanService(repository, clock);

        DailyPlanResponse response =
                service.getDailyPlan(ACCOUNT_ID, null);

        assertThat(response.timeZone()).isEqualTo("Asia/Ho_Chi_Minh");
        assertThat(response.currentDate())
                .isEqualTo(LocalDate.of(2026, 8, 12));
    }

    @Test
    void invalidOrBlankTimezoneReturnsValidationErrorData() {
        TaskRepository repository = mock(TaskRepository.class);
        Clock clock = Clock.fixed(INSTANT, ZoneOffset.UTC);
        DailyPlanService service = new DailyPlanService(repository, clock);

        for (String timeZone : List.of("", "   ", "Mars/Olympus")) {
            assertThatThrownBy(() ->
                    service.getDailyPlan(ACCOUNT_ID, timeZone))
                    .isInstanceOfSatisfying(
                            InvalidTaskFilterException.class,
                            exception -> assertThat(exception.getFieldErrors())
                                    .containsKey("xTimeZone"));
        }
    }

    private Task task(
            Account account,
            String title,
            TaskStatus status,
            LocalDate deadline) {

        Task task = Task.createIndependent(
                account,
                title,
                null,
                deadline,
                java.time.OffsetDateTime.parse(
                        "2026-08-10T10:00:00Z"));

        if (status != TaskStatus.NOT_STARTED) {
            task.changeStatus(
                    status,
                    java.time.OffsetDateTime.parse(
                            "2026-08-10T11:00:00Z"));
        }

        return task;
    }

    private Account account() {
        return Account.create(
                "plan@example.com",
                "hash",
                "Plan User",
                java.time.OffsetDateTime.parse(
                        "2026-08-10T09:00:00Z"));
    }
}