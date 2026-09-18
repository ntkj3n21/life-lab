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

import com.lifelab.organization.service.ItemOrganizationService;
import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskStatus;
import com.lifelab.task.dto.DailyPlanResponse;
import com.lifelab.task.dto.TaskResponse;
import com.lifelab.task.exception.InvalidTaskFilterException;
import com.lifelab.task.repository.TaskRepository;

@Service
public class DailyPlanService {

    private final TaskRepository taskRepository;
    private final ItemOrganizationService organizationService;
    private final Clock clock;

    public DailyPlanService(
            TaskRepository taskRepository,
            ItemOrganizationService organizationService,
            Clock clock) {
        this.taskRepository = taskRepository;
        this.organizationService = organizationService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public DailyPlanResponse getDailyPlan(Long accountId, String requestedTimeZone) {
        ZoneId zoneId = resolveZoneId(requestedTimeZone);
        LocalDate currentDate = LocalDate.ofInstant(clock.instant(), zoneId);

        List<Task> tasks =
                taskRepository.findAllByAccount_IdOrderByCreatedAtDescIdDesc(accountId);
        List<TaskResponse> taskResponses = organizationService.toTaskResponses(tasks);

        List<TaskResponse> overdue = new ArrayList<>();
        List<TaskResponse> today = new ArrayList<>();
        List<TaskResponse> upcoming = new ArrayList<>();
        List<TaskResponse> noDeadline = new ArrayList<>();
        List<TaskResponse> completed = new ArrayList<>();

        for (int index = 0; index < tasks.size(); index++) {
            Task task = tasks.get(index);
            TaskResponse response = taskResponses.get(index);

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
