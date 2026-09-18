package com.lifelab.source.image.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.source.image.dto.ImageContent;
import com.lifelab.source.image.service.LibraryImageService;

@RestController
@RequestMapping("/api/images")
public class ImageContentController {

    private final LibraryImageService libraryImageService;
    private final CurrentAccount currentAccount;

    public ImageContentController(
            LibraryImageService libraryImageService,
            CurrentAccount currentAccount) {
        this.libraryImageService = libraryImageService;
        this.currentAccount = currentAccount;
    }

    @GetMapping("/{sourceId}/content")
    public ResponseEntity<?> getContent(@PathVariable Long sourceId) {
        ImageContent content = libraryImageService.getUploadedContent(
                currentAccount.requireAccountId(), sourceId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.mediaType()))
                .contentLength(content.sizeBytes())
                .body(content.resource());
    }
}
