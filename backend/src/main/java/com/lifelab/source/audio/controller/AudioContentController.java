package com.lifelab.source.audio.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.source.audio.dto.AudioContent;
import com.lifelab.source.audio.service.LibraryAudioService;

@RestController
@RequestMapping("/api/audio")
public class AudioContentController {

    private final LibraryAudioService libraryAudioService;
    private final CurrentAccount currentAccount;

    public AudioContentController(
            LibraryAudioService libraryAudioService,
            CurrentAccount currentAccount) {
        this.libraryAudioService = libraryAudioService;
        this.currentAccount = currentAccount;
    }

    @GetMapping("/{sourceId}/content")
    public ResponseEntity<?> getContent(@PathVariable Long sourceId) {
        AudioContent content = libraryAudioService.getUploadedContent(
                currentAccount.requireAccountId(), sourceId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.mediaType()))
                .contentLength(content.sizeBytes())
                .body(content.resource());
    }
}
