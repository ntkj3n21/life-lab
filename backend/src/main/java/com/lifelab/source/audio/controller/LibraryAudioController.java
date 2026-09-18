package com.lifelab.source.audio.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.security.CurrentAccount;
import com.lifelab.common.validation.PaginationValidator;
import com.lifelab.source.audio.dto.CreateAudioRequest;
import com.lifelab.source.audio.dto.LibraryAudioResponse;
import com.lifelab.source.audio.service.LibraryAudioService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/library/audio")
public class LibraryAudioController {

    private final LibraryAudioService libraryAudioService;
    private final CurrentAccount currentAccount;

    public LibraryAudioController(
            LibraryAudioService libraryAudioService,
            CurrentAccount currentAccount) {
        this.libraryAudioService = libraryAudioService;
        this.currentAccount = currentAccount;
    }

    @PostMapping("/url")
    public ResponseEntity<LibraryAudioResponse> addAudio(
            @Valid @RequestBody CreateAudioRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                libraryAudioService.addAudio(
                        currentAccount.requireAccountId(), request));
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LibraryAudioResponse> uploadAudio(
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                libraryAudioService.uploadAudio(
                        currentAccount.requireAccountId(), file));
    }

    @GetMapping
    public PagedResponse<LibraryAudioResponse> getLibrary(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PaginationValidator.validate(page, size);
        return libraryAudioService.getLibrary(
                currentAccount.requireAccountId(), page, size);
    }

    @GetMapping("/{audioId}")
    public LibraryAudioResponse getAudio(@PathVariable Long audioId) {
        return libraryAudioService.getAudio(
                currentAccount.requireAccountId(), audioId);
    }

    @DeleteMapping("/{audioId}")
    public ResponseEntity<Void> removeAudio(@PathVariable Long audioId) {
        libraryAudioService.removeAudio(
                currentAccount.requireAccountId(), audioId);
        return ResponseEntity.noContent().build();
    }
}
