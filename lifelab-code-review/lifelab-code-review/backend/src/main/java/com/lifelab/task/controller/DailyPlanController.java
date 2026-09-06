package com.lifelab.task.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.task.dto.DailyPlanResponse;
import com.lifelab.task.service.DailyPlanService;

@RestController
@RequestMapping("/api/plan")
public class DailyPlanController {

    private final DailyPlanService dailyPlanService;
    private final CurrentAccount currentAccount;

    public DailyPlanController(
            DailyPlanService dailyPlanService,
            CurrentAccount currentAccount) {
        this.dailyPlanService = dailyPlanService;
        this.currentAccount = currentAccount;
    }

    @GetMapping
    public DailyPlanResponse getDailyPlan(
            @RequestHeader(value = "X-Time-Zone", required = false)
            String timeZone) {

        return dailyPlanService.getDailyPlan(
                currentAccount.requireAccountId(),
                timeZone);
    }
}