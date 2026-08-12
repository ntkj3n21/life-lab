package com.lifelab.watch.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.watch.dto.WatchSessionResponse;
import com.lifelab.watch.dto.WatchSessionHeartbeatRequest;
import com.lifelab.watch.dto.CloseWatchSessionRequest;
import com.lifelab.watch.service.WatchSessionService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class WatchSessionController {

    private final WatchSessionService watchSessionService;
    private final CurrentAccount currentAccount;

    public WatchSessionController(WatchSessionService watchSessionService, CurrentAccount currentAccount) {
        this.watchSessionService = watchSessionService;
        this.currentAccount = currentAccount;
    }

    @PostMapping("/library/videos/{libraryVideoId}/watch-sessions")
    public ResponseEntity<WatchSessionResponse> startSession(@PathVariable Long libraryVideoId) {
        WatchSessionResponse response = watchSessionService.startSession(
                currentAccount.requireAccountId(),
                libraryVideoId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/watch-sessions/{watchSessionId}/heartbeat")
    public WatchSessionResponse heartbeat(
            @PathVariable Long watchSessionId,
            @Valid @RequestBody WatchSessionHeartbeatRequest request) {
        return watchSessionService.heartbeat(
                currentAccount.requireAccountId(),
                watchSessionId,
                request);
    }

    @PostMapping("/watch-sessions/{watchSessionId}/close")
    public WatchSessionResponse closeSession(
            @PathVariable Long watchSessionId,
            @Valid @RequestBody CloseWatchSessionRequest request) {
        return watchSessionService.closeSession(
                currentAccount.requireAccountId(),
                watchSessionId,
                request);
    }
}
