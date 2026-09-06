package com.lifelab.task.dto;

import java.time.LocalDate;
import java.util.List;

public record DailyPlanResponse(
        LocalDate currentDate,
        String timeZone,
        List<TaskResponse> overdue,
        List<TaskResponse> today,
        List<TaskResponse> upcoming,
        List<TaskResponse> noDeadline,
        List<TaskResponse> completed) {

    public DailyPlanResponse {
        overdue = List.copyOf(overdue);
        today = List.copyOf(today);
        upcoming = List.copyOf(upcoming);
        noDeadline = List.copyOf(noDeadline);
        completed = List.copyOf(completed);
    }
}