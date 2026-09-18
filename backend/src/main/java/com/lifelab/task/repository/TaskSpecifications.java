package com.lifelab.task.repository;

import java.time.LocalDate;
import java.util.Collection;

import org.springframework.data.jpa.domain.Specification;

import com.lifelab.task.domain.Task;
import com.lifelab.task.domain.TaskTag;
import com.lifelab.task.domain.TaskStatus;
import com.lifelab.task.domain.TaskSourceStatus;

import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

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

    public static Specification<Task> hasCategory(Long categoryId) {
        return (root, query, builder) -> builder.equal(root.get("category").get("id"), categoryId);
    }

    public static Specification<Task> hasAnyTag(Collection<Long> tagIds) {
        return (root, query, builder) -> {
            Subquery<Long> taggedTasks = query.subquery(Long.class);
            Root<TaskTag> taskTag = taggedTasks.from(TaskTag.class);
            taggedTasks.select(taskTag.get("task").get("id"));
            taggedTasks.where(
                    builder.equal(taskTag.get("task").get("id"), root.get("id")),
                    taskTag.get("tag").get("id").in(tagIds));
            return builder.exists(taggedTasks);
        };
    }

    public static Specification<Task> hasSourceStatus(TaskSourceStatus sourceStatus) {
        return (root, query, builder) -> builder.equal(root.get("sourceStatus"), sourceStatus);
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

    public static Specification<Task> hasSourceFromYoutubeVideo(Long youtubeSourceId) {
        return (root, query, builder) -> builder.and(
                builder.equal(root.get("sourceStatus"), TaskSourceStatus.HAS_SOURCE),
                builder.equal(
                        root.get("sourceNote").get("youtubeSource").get("id"),
                        youtubeSourceId));
    }

    public static Specification<Task> hasSourceFromImage(Long imageSourceId) {
        return (root, query, builder) -> builder.and(
                builder.equal(root.get("sourceStatus"), TaskSourceStatus.HAS_SOURCE),
                builder.equal(
                        root.get("sourceNote").get("imageSource").get("id"),
                        imageSourceId));
    }

    public static Specification<Task> hasSourceFromAudio(Long audioSourceId) {
        return (root, query, builder) -> builder.and(
                builder.equal(root.get("sourceStatus"), TaskSourceStatus.HAS_SOURCE),
                builder.equal(
                        root.get("sourceNote").get("audioSource").get("id"),
                        audioSourceId));
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
