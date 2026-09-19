package com.lifelab.source.image.controller;

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
import com.lifelab.source.image.dto.CreateExternalImageRequest;
import com.lifelab.source.image.dto.LibraryImageResponse;
import com.lifelab.source.image.service.LibraryImageService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/library/images")
public class LibraryImageController {

        private final LibraryImageService libraryImageService;
        private final CurrentAccount currentAccount;

        public LibraryImageController(
                        LibraryImageService libraryImageService,
                        CurrentAccount currentAccount) {
                this.libraryImageService = libraryImageService;
                this.currentAccount = currentAccount;
        }

        @PostMapping("/url")
        public ResponseEntity<LibraryImageResponse> addExternalImage(
                        @Valid @RequestBody CreateExternalImageRequest request) {
                return ResponseEntity.status(HttpStatus.CREATED).body(
                                libraryImageService.addExternalImage(
                                                currentAccount.requireAccountId(), request));
        }

        @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        public ResponseEntity<LibraryImageResponse> uploadImage(
                @RequestPart("file") MultipartFile file,
                @RequestPart(value = "title", required = false) String title) {

        return ResponseEntity.status(HttpStatus.CREATED).body(
                libraryImageService.uploadImage(
                        currentAccount.requireAccountId(),
                        file,
                        title));
        }

        @GetMapping
        public PagedResponse<LibraryImageResponse> getLibrary(
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "20") int size,
                        @RequestParam(required = false) String q) {
                PaginationValidator.validate(
                                page,
                                size);

                return libraryImageService.getLibrary(
                                currentAccount.requireAccountId(),
                                page,
                                size,
                                q);
        }

        @GetMapping("/{imageId}")
        public LibraryImageResponse getImage(@PathVariable Long imageId) {
                return libraryImageService.getImage(
                                currentAccount.requireAccountId(), imageId);
        }

        @DeleteMapping("/{imageId}")
        public ResponseEntity<Void> removeImage(@PathVariable Long imageId) {
                libraryImageService.removeImage(
                                currentAccount.requireAccountId(), imageId);
                return ResponseEntity.noContent().build();
        }
}
