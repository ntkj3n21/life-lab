package com.lifelab.organization.category.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.common.exception.UnauthenticatedException;
import com.lifelab.common.persistence.DatabaseConstraintMatcher;
import com.lifelab.note.repository.NoteRepository;
import com.lifelab.organization.category.domain.Category;
import com.lifelab.organization.category.dto.CategoryDeleteImpactResponse;
import com.lifelab.organization.category.dto.CategoryResponse;
import com.lifelab.organization.category.dto.CreateCategoryRequest;
import com.lifelab.organization.category.dto.RenameCategoryRequest;
import com.lifelab.organization.category.exception.CategoryAlreadyExistsException;
import com.lifelab.organization.category.exception.CategoryNotFoundException;
import com.lifelab.organization.category.repository.CategoryRepository;
import com.lifelab.task.repository.TaskRepository;

@Service
public class CategoryService {

    private static final String CATEGORY_NAME_UNIQUE_CONSTRAINT =
            "uk_categories_account_normalized_name";

    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final NoteRepository noteRepository;
    private final TaskRepository taskRepository;
    private final CategoryNameNormalizer categoryNameNormalizer;
    private final Clock clock;

    public CategoryService(
            AccountRepository accountRepository,
            CategoryRepository categoryRepository,
            NoteRepository noteRepository,
            TaskRepository taskRepository,
            CategoryNameNormalizer categoryNameNormalizer,
            Clock clock) {
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.noteRepository = noteRepository;
        this.taskRepository = taskRepository;
        this.categoryNameNormalizer = categoryNameNormalizer;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getCategories(Long accountId) {
        return categoryRepository
                .findAllByAccount_IdOrderByNormalizedNameAscIdAsc(accountId)
                .stream()
                .map(CategoryResponse::from)
                .toList();
    }

    @Transactional
    public CategoryResponse createCategory(Long accountId, CreateCategoryRequest request) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(UnauthenticatedException::new);

        NormalizedCategoryName normalized = normalize(request.name());

        categoryRepository
                .findByAccount_IdAndNormalizedName(accountId, normalized.comparisonName())
                .ifPresent(existing -> {
                    throw new CategoryAlreadyExistsException();
                });

        Category category = Category.create(
                account,
                normalized.displayName(),
                normalized.comparisonName(),
                OffsetDateTime.now(clock));

        return save(category);
    }

    @Transactional
    public CategoryResponse renameCategory(
            Long accountId,
            Long categoryId,
            RenameCategoryRequest request) {
        Category category = findOwnedCategory(accountId, categoryId);
        NormalizedCategoryName normalized = normalize(request.name());

        categoryRepository
                .findByAccount_IdAndNormalizedName(accountId, normalized.comparisonName())
                .filter(existing -> !existing.getId().equals(category.getId()))
                .ifPresent(existing -> {
                    throw new CategoryAlreadyExistsException();
                });

        category.rename(
                normalized.displayName(),
                normalized.comparisonName(),
                OffsetDateTime.now(clock));

        return save(category);
    }

    @Transactional(readOnly = true)
    public CategoryDeleteImpactResponse getDeleteImpact(Long accountId, Long categoryId) {
        Category category = findOwnedCategory(accountId, categoryId);
        return new CategoryDeleteImpactResponse(
                category.getId(),
                noteRepository.countByAccount_IdAndCategory_Id(accountId, categoryId),
                taskRepository.countByAccount_IdAndCategory_Id(accountId, categoryId),
                true,
                true);
    }

    @Transactional
    public void deleteCategory(Long accountId, Long categoryId) {
        Category category = findOwnedCategory(accountId, categoryId);
        categoryRepository.delete(category);
        categoryRepository.flush();
    }

    public Category findOwnedCategory(Long accountId, Long categoryId) {
        if (categoryId == null) {
            return null;
        }
        return categoryRepository
                .findByIdAndAccount_Id(categoryId, accountId)
                .orElseThrow(CategoryNotFoundException::new);
    }

    private NormalizedCategoryName normalize(String rawName) {
        String displayName = categoryNameNormalizer.normalizeDisplayName(rawName);
        return new NormalizedCategoryName(
                displayName,
                categoryNameNormalizer.normalizeForComparison(displayName));
    }

    private CategoryResponse save(Category category) {
        try {
            return CategoryResponse.from(categoryRepository.saveAndFlush(category));
        } catch (DataIntegrityViolationException exception) {
            if (DatabaseConstraintMatcher.matches(
                    exception,
                    CATEGORY_NAME_UNIQUE_CONSTRAINT)) {
                throw new CategoryAlreadyExistsException();
            }
            throw exception;
        }
    }

    private record NormalizedCategoryName(
            String displayName,
            String comparisonName) {
    }
}
