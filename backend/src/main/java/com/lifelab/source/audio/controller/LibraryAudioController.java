package com.lifelab.source.audio.controller;

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
import com.lifelab.source.audio.dto.CreateAudioRequest;
import com.lifelab.source.audio.dto.LibraryAudioResponse;
import com.lifelab.source.audio.dto.UpdateLibraryAudioRequest;
import com.lifelab.source.audio.domain.AudioOrigin;
import com.lifelab.source.audio.service.LibraryAudioService;
import com.lifelab.video.dto.TagResponse;

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
                        @RequestPart("file") MultipartFile file,
                        @RequestPart(value = "title", required = false) String title) {
                return ResponseEntity.status(HttpStatus.CREATED).body(
                                libraryAudioService.uploadAudio(
                                                currentAccount.requireAccountId(),
                                                file,
                                                title));
        }

        @GetMapping
        public PagedResponse<LibraryAudioResponse> getLibrary(
                        @RequestParam(defaultValue = "0") int page,
                        @RequestParam(defaultValue = "20") int size,
                        @RequestParam(required = false) String q,
                        @RequestParam(required = false, name = "tagId") List<Long> tagIds,
                        @RequestParam(required = false) Boolean hasNotes,
                        @RequestParam(required = false) AudioOrigin origin,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate addedFrom,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate addedTo,
                        @RequestParam(required = false) String sortBy,
                        @RequestParam(required = false) String sortDirection) {
                PaginationValidator.validate(
                                page,
                                size);

                return libraryAudioService.getLibrary(
                                currentAccount.requireAccountId(),
                                page,
                                size,
                                q, tagIds, hasNotes, origin, addedFrom, addedTo, sortBy, sortDirection);
        }

        @GetMapping("/{audioId}")
        public LibraryAudioResponse getAudio(@PathVariable Long audioId) {
                return libraryAudioService.getAudio(
                                currentAccount.requireAccountId(), audioId);
        }

        @PatchMapping("/{audioId}")
        public LibraryAudioResponse updateAudio(@PathVariable Long audioId,
                        @Valid @RequestBody UpdateLibraryAudioRequest request) {
                return libraryAudioService.updateAudio(currentAccount.requireAccountId(), audioId, request);
        }

        @GetMapping("/{audioId}/tags")
        public List<TagResponse> getTags(@PathVariable Long audioId) {
                return libraryAudioService.getTags(currentAccount.requireAccountId(), audioId);
        }

        @PutMapping("/{audioId}/tags/{tagId}")
        public ResponseEntity<Void> attachTag(@PathVariable Long audioId, @PathVariable Long tagId) {
                libraryAudioService.attachTag(currentAccount.requireAccountId(), audioId, tagId);
                return ResponseEntity.noContent().build();
        }

        @DeleteMapping("/{audioId}/tags/{tagId}")
        public ResponseEntity<Void> detachTag(@PathVariable Long audioId, @PathVariable Long tagId) {
                libraryAudioService.detachTag(currentAccount.requireAccountId(), audioId, tagId);
                return ResponseEntity.noContent().build();
        }

        @DeleteMapping("/{audioId}")
        public ResponseEntity<Void> removeAudio(@PathVariable Long audioId) {
                libraryAudioService.removeAudio(
                                currentAccount.requireAccountId(), audioId);
                return ResponseEntity.noContent().build();
        }
}
