package com.lifelab.note.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.note.dto.CreateNoteRequest;
import com.lifelab.note.dto.NoteResponse;
import com.lifelab.note.service.NoteService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/library/videos/{libraryVideoId}/notes")
public class VideoNoteController {

    private final NoteService noteService;
    private final CurrentAccount currentAccount;

    public VideoNoteController(NoteService noteService, CurrentAccount currentAccount) {
        this.noteService = noteService;
        this.currentAccount = currentAccount;
    }

    @PostMapping
    public ResponseEntity<NoteResponse> createNote(
            @PathVariable Long libraryVideoId,
            @Valid @RequestBody CreateNoteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(noteService.createNote(
                currentAccount.requireAccountId(),
                libraryVideoId,
                request));
    }

    @GetMapping
    public List<NoteResponse> getVideoNotes(@PathVariable Long libraryVideoId) {
        return noteService.getVideoNotes(currentAccount.requireAccountId(), libraryVideoId);
    }
}
