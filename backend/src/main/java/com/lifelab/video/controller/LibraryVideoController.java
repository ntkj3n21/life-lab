package com.lifelab.video.controller;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.exception.InvalidPaginationException;
import com.lifelab.video.exception.InvalidLibraryFilterException;
import com.lifelab.common.security.CurrentAccount;
import com.lifelab.video.dto.AddLibraryVideoRequest;
import com.lifelab.video.dto.LibraryVideoDeleteImpactResponse;
import com.lifelab.video.dto.LibraryVideoResponse;
import com.lifelab.video.dto.UpdateLibraryVideoRequest;
import com.lifelab.video.service.LibraryVideoService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/library/videos")
public class LibraryVideoController {

    private final LibraryVideoService libraryVideoService;
    private final CurrentAccount currentAccount;

    public LibraryVideoController(LibraryVideoService libraryVideoService, CurrentAccount currentAccount) {
        this.libraryVideoService = libraryVideoService;
        this.currentAccount = currentAccount;
    }

    @PostMapping
    public ResponseEntity<LibraryVideoResponse> addVideo(
            @Valid @RequestBody AddLibraryVideoRequest request) {
        Long accountId = currentAccount.requireAccountId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(libraryVideoService.addVideo(accountId, request));
    }

    @GetMapping
    public PagedResponse<LibraryVideoResponse> getLibrary(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer minDurationSeconds,
            @RequestParam(required = false) Integer maxDurationSeconds,
            @RequestParam(required = false) LocalDate publishedFrom,
            @RequestParam(required = false) LocalDate publishedTo,
            @RequestParam(required = false) LocalDate addedFrom,
            @RequestParam(required = false) LocalDate addedTo,
            @RequestParam(required = false, name = "tagId") List<Long> tagIds,
            @RequestParam(required = false) Boolean watched,
            @RequestParam(required = false) Boolean hasNotes,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection) {
        validatePagination(page, size);
        validateFilters(
                minDurationSeconds,
                maxDurationSeconds,
                publishedFrom,
                publishedTo,
                addedFrom,
                addedTo);
        String effectiveSortBy = validateSortBy(sortBy);
        String effectiveSortDirection = validateSortDirection(sortDirection);
        return libraryVideoService.getLibrary(
                currentAccount.requireAccountId(),
                page,
                size,
                q,
                minDurationSeconds,
                maxDurationSeconds,
                publishedFrom,
                publishedTo,
                addedFrom,
                addedTo,
                tagIds,
                watched,
                hasNotes,
                effectiveSortBy,
                effectiveSortDirection);
    }

    @GetMapping("/{id}")
    public LibraryVideoResponse getVideo(@PathVariable Long id) {
        return libraryVideoService.getVideo(currentAccount.requireAccountId(), id);
    }

    @PatchMapping("/{id}")
    public LibraryVideoResponse updateVideo(
            @PathVariable Long id,
            @Valid @RequestBody UpdateLibraryVideoRequest request) {
        return libraryVideoService.updateVideo(currentAccount.requireAccountId(), id, request);
    }

    @GetMapping("/{id}/delete-impact")
    public LibraryVideoDeleteImpactResponse getDeleteImpact(@PathVariable Long id) {
        return libraryVideoService.getDeleteImpact(currentAccount.requireAccountId(), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVideo(@PathVariable Long id) {
        libraryVideoService.deleteVideo(currentAccount.requireAccountId(), id);
        return ResponseEntity.noContent().build();
    }

    private void validatePagination(int page, int size) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        if (page < 0) {
            fieldErrors.put("page", "must be greater than or equal to 0");
        }
        if (size < 1 || size > 100) {
            fieldErrors.put("size", "must be between 1 and 100");
        }
        if (!fieldErrors.isEmpty()) {
            throw new InvalidPaginationException(fieldErrors);
        }
    }

    private void validateFilters(
            Integer minDurationSeconds,
            Integer maxDurationSeconds,
            LocalDate publishedFrom,
            LocalDate publishedTo,
            LocalDate addedFrom,
            LocalDate addedTo) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        if (minDurationSeconds != null && minDurationSeconds < 0) {
            fieldErrors.put("minDurationSeconds", "must be greater than or equal to 0");
        }
        if (maxDurationSeconds != null && maxDurationSeconds < 0) {
            fieldErrors.put("maxDurationSeconds", "must be greater than or equal to 0");
        }
        if (minDurationSeconds != null && maxDurationSeconds != null
                && minDurationSeconds > maxDurationSeconds) {
            fieldErrors.putIfAbsent("minDurationSeconds", "must be less than or equal to maxDurationSeconds");
            fieldErrors.putIfAbsent("maxDurationSeconds", "must be greater than or equal to minDurationSeconds");
        }
        if (publishedFrom != null && publishedTo != null && publishedFrom.isAfter(publishedTo)) {
            fieldErrors.put("publishedFrom", "must be on or before publishedTo");
            fieldErrors.put("publishedTo", "must be on or after publishedFrom");
        }
        if (addedFrom != null && addedTo != null && addedFrom.isAfter(addedTo)) {
            fieldErrors.put("addedFrom", "must be on or before addedTo");
            fieldErrors.put("addedTo", "must be on or after addedFrom");
        }
        if (!fieldErrors.isEmpty()) {
            throw new InvalidLibraryFilterException(fieldErrors);
        }
    }

    private String validateSortBy(String sortBy) {
        if (sortBy == null) {
            return "addedAt";
        }
        if (!List.of("addedAt", "duration", "viewCount", "lastWatchedAt").contains(sortBy)) {
            throw new InvalidLibraryFilterException(Map.of("sortBy", "must be a supported sort field"));
        }
        return sortBy;
    }

    private String validateSortDirection(String sortDirection) {
        if (sortDirection == null) {
            return "desc";
        }
        if (!List.of("asc", "desc").contains(sortDirection)) {
            throw new InvalidLibraryFilterException(Map.of(
                    "sortDirection", "must be either asc or desc"));
        }
        return sortDirection;
    }
}
