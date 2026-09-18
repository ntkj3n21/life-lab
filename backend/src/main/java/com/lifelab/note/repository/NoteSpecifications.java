package com.lifelab.note.repository;

import java.util.Collection;

import org.springframework.data.jpa.domain.Specification;

import com.lifelab.note.domain.Note;
import com.lifelab.note.domain.NoteTag;

import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

public final class NoteSpecifications {

    private NoteSpecifications() {
    }

    public static Specification<Note> ownedBy(Long accountId) {
        return (root, query, builder) -> builder.equal(root.get("account").get("id"), accountId);
    }

    public static Specification<Note> keywordContains(String keyword) {
        return (root, query, builder) -> {
            var youtubeSource = root.join("youtubeSource", JoinType.LEFT);
            var imageSource = root.join("imageSource", JoinType.LEFT);
            var audioSource = root.join("audioSource", JoinType.LEFT);
            return builder.or(
                    contains(builder.lower(root.get("content")), keyword, builder),
                    contains(builder.lower(youtubeSource.get("title")), keyword, builder),
                    contains(builder.lower(youtubeSource.get("channelName")), keyword, builder),
                    contains(builder.lower(youtubeSource.get("youtubeVideoId")), keyword, builder),
                    contains(builder.lower(youtubeSource.get("sourceUrl")), keyword, builder),
                    contains(builder.lower(imageSource.get("externalUrl")), keyword, builder),
                    contains(builder.lower(imageSource.get("originalFilename")), keyword, builder),
                    contains(builder.lower(audioSource.get("externalUrl")), keyword, builder),
                    contains(builder.lower(audioSource.get("originalFilename")), keyword, builder));
        };
    }

    public static Specification<Note> hasCategory(Long categoryId) {
        return (root, query, builder) -> builder.equal(root.get("category").get("id"), categoryId);
    }

    public static Specification<Note> hasAnyTag(Collection<Long> tagIds) {
        return (root, query, builder) -> {
            Subquery<Long> taggedNotes = query.subquery(Long.class);
            Root<NoteTag> noteTag = taggedNotes.from(NoteTag.class);
            taggedNotes.select(noteTag.get("note").get("id"));
            taggedNotes.where(
                    builder.equal(noteTag.get("note").get("id"), root.get("id")),
                    noteTag.get("tag").get("id").in(tagIds));
            return builder.exists(taggedNotes);
        };
    }

    public static Specification<Note> hasTimestamp(boolean hasTimestamp) {
        return (root, query, builder) -> hasTimestamp
                ? builder.isNotNull(root.get("timestampSeconds"))
                : builder.isNull(root.get("timestampSeconds"));
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
