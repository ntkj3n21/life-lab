package com.lifelab.video.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.video.dto.TagResponse;
import com.lifelab.video.service.TagService;

@RestController
@RequestMapping("/api/library/videos/{libraryVideoId}/tags")
public class LibraryVideoTagController {

    private final TagService tagService;
    private final CurrentAccount currentAccount;

    public LibraryVideoTagController(TagService tagService, CurrentAccount currentAccount) {
        this.tagService = tagService;
        this.currentAccount = currentAccount;
    }

    @GetMapping
    public List<TagResponse> getVideoTags(@PathVariable Long libraryVideoId) {
        return tagService.getVideoTags(currentAccount.requireAccountId(), libraryVideoId);
    }

    @PutMapping("/{tagId}")
    public ResponseEntity<Void> attachTag(
            @PathVariable Long libraryVideoId,
            @PathVariable Long tagId) {
        tagService.attachTag(currentAccount.requireAccountId(), libraryVideoId, tagId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{tagId}")
    public ResponseEntity<Void> detachTag(
            @PathVariable Long libraryVideoId,
            @PathVariable Long tagId) {
        tagService.detachTag(currentAccount.requireAccountId(), libraryVideoId, tagId);
        return ResponseEntity.noContent().build();
    }
}
