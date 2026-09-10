package com.lifelab.organization.category.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.common.security.CurrentAccount;
import com.lifelab.organization.category.dto.CategoryDeleteImpactResponse;
import com.lifelab.organization.category.dto.CategoryResponse;
import com.lifelab.organization.category.dto.CreateCategoryRequest;
import com.lifelab.organization.category.dto.RenameCategoryRequest;
import com.lifelab.organization.category.service.CategoryService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryService categoryService;
    private final CurrentAccount currentAccount;

    public CategoryController(CategoryService categoryService, CurrentAccount currentAccount) {
        this.categoryService = categoryService;
        this.currentAccount = currentAccount;
    }

    @GetMapping
    public List<CategoryResponse> getCategories() {
        return categoryService.getCategories(currentAccount.requireAccountId());
    }

    @PostMapping
    public ResponseEntity<CategoryResponse> createCategory(
            @Valid @RequestBody CreateCategoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(categoryService.createCategory(
                        currentAccount.requireAccountId(),
                        request));
    }

    @PatchMapping("/{categoryId}")
    public CategoryResponse renameCategory(
            @PathVariable Long categoryId,
            @Valid @RequestBody RenameCategoryRequest request) {
        return categoryService.renameCategory(
                currentAccount.requireAccountId(),
                categoryId,
                request);
    }

    @GetMapping("/{categoryId}/delete-impact")
    public CategoryDeleteImpactResponse getDeleteImpact(@PathVariable Long categoryId) {
        return categoryService.getDeleteImpact(
                currentAccount.requireAccountId(),
                categoryId);
    }

    @DeleteMapping("/{categoryId}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long categoryId) {
        categoryService.deleteCategory(currentAccount.requireAccountId(), categoryId);
        return ResponseEntity.noContent().build();
    }
}
