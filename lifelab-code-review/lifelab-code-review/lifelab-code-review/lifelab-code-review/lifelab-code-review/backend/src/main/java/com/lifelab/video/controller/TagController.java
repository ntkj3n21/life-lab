package com.lifelab.video.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.video.dto.CreateTagRequest;
import com.lifelab.video.dto.RenameTagRequest;
import com.lifelab.video.dto.TagResponse;
import com.lifelab.video.dto.TagDeleteImpactResponse;
import com.lifelab.video.service.TagService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/tags")
public class TagController {

    private final TagService tagService;
    private final CurrentAccount currentAccount;

    public TagController(TagService tagService, CurrentAccount currentAccount) {
        this.tagService = tagService;
        this.currentAccount = currentAccount;
    }

    @GetMapping
    public List<TagResponse> getTags() {
        return tagService.getTags(currentAccount.requireAccountId());
    }

    @PostMapping
    public ResponseEntity<TagResponse> createTag(@Valid @RequestBody CreateTagRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(tagService.createTag(currentAccount.requireAccountId(), request));
    }

    @PatchMapping("/{tagId}")
    public TagResponse renameTag(
            @PathVariable Long tagId,
            @Valid @RequestBody RenameTagRequest request) {
        return tagService.renameTag(currentAccount.requireAccountId(), tagId, request);
    }

    @GetMapping("/{tagId}/delete-impact")
    public TagDeleteImpactResponse getDeleteImpact(@PathVariable Long tagId) {
        return tagService.getDeleteImpact(currentAccount.requireAccountId(), tagId);
    }

    @DeleteMapping("/{tagId}")
    public ResponseEntity<Void> deleteTag(@PathVariable Long tagId) {
        tagService.deleteTag(currentAccount.requireAccountId(), tagId);
        return ResponseEntity.noContent().build();
    }
}
