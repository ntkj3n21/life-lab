package com.lifelab.source.image.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDate;
import java.util.List;

import com.lifelab.common.dto.PagedResponse;
import com.lifelab.common.security.CurrentAccount;
import com.lifelab.common.validation.PaginationValidator;
import com.lifelab.source.image.dto.CreateExternalImageRequest;
import com.lifelab.source.image.dto.LibraryImageResponse;
import com.lifelab.source.image.dto.UpdateLibraryImageRequest;
import com.lifelab.source.image.domain.ImageOrigin;
import com.lifelab.source.image.service.LibraryImageService;
import com.lifelab.video.dto.TagResponse;

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
                        @RequestParam(required = false) String q,
                        @RequestParam(required = false, name = "tagId") List<Long> tagIds,
                        @RequestParam(required = false) Boolean hasNotes,
                        @RequestParam(required = false) ImageOrigin origin,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate addedFrom,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate addedTo,
                        @RequestParam(required = false) String sortBy,
                        @RequestParam(required = false) String sortDirection) {
                PaginationValidator.validate(
                                page,
                                size);

                return libraryImageService.getLibrary(
                                currentAccount.requireAccountId(),
                                page,
                                size,
                                q, tagIds, hasNotes, origin, addedFrom, addedTo, sortBy, sortDirection);
        }

        @GetMapping("/{imageId}")
        public LibraryImageResponse getImage(@PathVariable Long imageId) {
                return libraryImageService.getImage(
                                currentAccount.requireAccountId(), imageId);
        }

        @PatchMapping("/{imageId}")
        public LibraryImageResponse updateImage(@PathVariable Long imageId,
                        @Valid @RequestBody UpdateLibraryImageRequest request) {
                return libraryImageService.updateImage(currentAccount.requireAccountId(), imageId, request);
        }

        @GetMapping("/{imageId}/tags")
        public List<TagResponse> getTags(@PathVariable Long imageId) {
                return libraryImageService.getTags(currentAccount.requireAccountId(), imageId);
        }

        @PutMapping("/{imageId}/tags/{tagId}")
        public ResponseEntity<Void> attachTag(@PathVariable Long imageId, @PathVariable Long tagId) {
                libraryImageService.attachTag(currentAccount.requireAccountId(), imageId, tagId);
                return ResponseEntity.noContent().build();
        }

        @DeleteMapping("/{imageId}/tags/{tagId}")
        public ResponseEntity<Void> detachTag(@PathVariable Long imageId, @PathVariable Long tagId) {
                libraryImageService.detachTag(currentAccount.requireAccountId(), imageId, tagId);
                return ResponseEntity.noContent().build();
        }

        @DeleteMapping("/{imageId}")
        public ResponseEntity<Void> removeImage(@PathVariable Long imageId) {
                libraryImageService.removeImage(
                                currentAccount.requireAccountId(), imageId);
                return ResponseEntity.noContent().build();
        }
}
