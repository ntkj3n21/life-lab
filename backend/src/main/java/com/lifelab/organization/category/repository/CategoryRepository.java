package com.lifelab.organization.category.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lifelab.organization.category.domain.Category;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    Optional<Category> findByIdAndAccount_Id(Long categoryId, Long accountId);

    Optional<Category> findByAccount_IdAndNormalizedName(Long accountId, String normalizedName);

    List<Category> findAllByAccount_IdOrderByNormalizedNameAscIdAsc(Long accountId);
}
