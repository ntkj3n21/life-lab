package com.lifelab.task.service;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskStatus;
import com.lifelab.task.dto.DailyPlanResponse;
import com.lifelab.task.dto.TaskResponse;
import com.lifelab.task.exception.InvalidTaskFilterException;
import com.lifelab.task.repository.TaskRepository;

@Service
public class DailyPlanService {

    private final TaskRepository taskRepository;
    private final Clock clock;

    public DailyPlanService(TaskRepository taskRepository, Clock clock) {
        this.taskRepository = taskRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DailyPlanResponse getDailyPlan(Long accountId, String requestedTimeZone) {
        ZoneId zoneId = resolveZoneId(requestedTimeZone);
        LocalDate currentDate = LocalDate.ofInstant(clock.instant(), zoneId);

        List<Task> tasks =
                taskRepository.findAllByAccount_IdOrderByCreatedAtDescIdDesc(accountId);

        List<TaskResponse> overdue = new ArrayList<>();
        List<TaskResponse> today = new ArrayList<>();
        List<TaskResponse> upcoming = new ArrayList<>();
        List<TaskResponse> noDeadline = new ArrayList<>();
        List<TaskResponse> completed = new ArrayList<>();

        for (Task task : tasks) {
            TaskResponse response = TaskResponse.from(task);

            if (task.getStatus() == TaskStatus.COMPLETED) {
                completed.add(response);
                continue;
            }

            LocalDate deadline = task.getDeadline();

            if (deadline == null) {
                noDeadline.add(response);
            } else if (deadline.isBefore(currentDate)) {
                overdue.add(response);
            } else if (deadline.isEqual(currentDate)) {
                today.add(response);
            } else {
                upcoming.add(response);
            }
        }

        return new DailyPlanResponse(
                currentDate,
                zoneId.getId(),
                overdue,
                today,
                upcoming,
                noDeadline,
                completed);
    }

    private ZoneId resolveZoneId(String requestedTimeZone) {
        if (requestedTimeZone == null) {
            return clock.getZone();
        }

        if (requestedTimeZone.isBlank()) {
            throw invalidTimeZone();
        }

        try {
            return ZoneId.of(requestedTimeZone);
        } catch (DateTimeException exception) {
            throw invalidTimeZone();
        }
    }

    private InvalidTaskFilterException invalidTimeZone() {
        return new InvalidTaskFilterException(Map.of(
                "xTimeZone",
                "must be a valid time zone"));
    }
}