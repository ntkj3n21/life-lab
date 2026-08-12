package com.lifelab.note.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.exception.InvalidPaginationException;
import com.lifelab.common.security.CurrentAccount;
import com.lifelab.note.dto.NoteDeleteImpactResponse;
import com.lifelab.note.dto.NoteResponse;
import com.lifelab.note.dto.UpdateNoteRequest;
import com.lifelab.note.service.NoteService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteService noteService;
    private final CurrentAccount currentAccount;

    public NoteController(NoteService noteService, CurrentAccount currentAccount) {
        this.noteService = noteService;
        this.currentAccount = currentAccount;
    }

    @GetMapping
    public PagedResponse<NoteResponse> getNotes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q) {
        validatePagination(page, size);
        return noteService.getNotes(currentAccount.requireAccountId(), page, size, q);
    }

    @GetMapping("/{noteId}")
    public NoteResponse getNote(@PathVariable Long noteId) {
        return noteService.getNote(currentAccount.requireAccountId(), noteId);
    }

    @PatchMapping("/{noteId}")
    public NoteResponse updateNote(
            @PathVariable Long noteId,
            @Valid @RequestBody UpdateNoteRequest request) {
        return noteService.updateNote(currentAccount.requireAccountId(), noteId, request);
    }

    @GetMapping("/{noteId}/delete-impact")
    public NoteDeleteImpactResponse getDeleteImpact(@PathVariable Long noteId) {
        return noteService.getDeleteImpact(currentAccount.requireAccountId(), noteId);
    }

    @DeleteMapping("/{noteId}")
    public ResponseEntity<Void> deleteNote(@PathVariable Long noteId) {
        noteService.deleteNote(currentAccount.requireAccountId(), noteId);
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
}
