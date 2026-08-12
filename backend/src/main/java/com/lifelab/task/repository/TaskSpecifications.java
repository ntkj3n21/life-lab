package com.lifelab.task.repository;

import java.time.LocalDate;

import org.springframework.data.jpa.domain.Specification;

import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskStatus;

import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;

public final class TaskSpecifications {

    private TaskSpecifications() {
    }

    public static Specification<Task> ownedBy(Long accountId) {
        return (root, query, builder) -> builder.equal(root.get("account").get("id"), accountId);
    }

    public static Specification<Task> keywordContains(String keyword) {
        return (root, query, builder) -> builder.or(
                contains(builder.lower(root.get("title")), keyword, builder),
                contains(builder.lower(root.get("description")), keyword, builder));
    }

    public static Specification<Task> hasStatus(TaskStatus status) {
        return (root, query, builder) -> builder.equal(root.get("status"), status);
    }

    public static Specification<Task> deadlineBetween(LocalDate from, LocalDate to) {
        return (root, query, builder) -> {
            Predicate predicate = builder.isNotNull(root.get("deadline"));
            if (from != null) {
                predicate = builder.and(
                        predicate,
                        builder.greaterThanOrEqualTo(root.get("deadline"), from));
            }
            if (to != null) {
                predicate = builder.and(
                        predicate,
                        builder.lessThanOrEqualTo(root.get("deadline"), to));
            }
            return predicate;
        };
    }

    private static Predicate contains(
            Expression<String> expression,
            String keyword,
            jakarta.persistence.criteria.CriteriaBuilder builder) {
        return builder.like(expression, "%" + escapeLike(keyword) + "%", '\\');
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
