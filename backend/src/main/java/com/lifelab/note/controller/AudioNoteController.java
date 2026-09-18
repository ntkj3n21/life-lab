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
@RequestMapping("/api/library/audio/{audioId}/notes")
public class AudioNoteController {

    private final NoteService noteService;
    private final CurrentAccount currentAccount;

    public AudioNoteController(NoteService noteService, CurrentAccount currentAccount) {
        this.noteService = noteService;
        this.currentAccount = currentAccount;
    }

    @PostMapping
    public ResponseEntity<NoteResponse> createNote(
            @PathVariable Long audioId,
            @Valid @RequestBody CreateNoteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                noteService.createAudioNote(
                        currentAccount.requireAccountId(), audioId, request));
    }

    @GetMapping
    public List<NoteResponse> getAudioNotes(@PathVariable Long audioId) {
        return noteService.getAudioNotes(currentAccount.requireAccountId(), audioId);
    }
}
