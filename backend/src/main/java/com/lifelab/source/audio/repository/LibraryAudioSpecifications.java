package com.lifelab.source.audio.repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import com.lifelab.common.text.SearchExpressions;
import com.lifelab.note.domain.Note;
import com.lifelab.source.audio.domain.AudioOrigin;
import com.lifelab.source.audio.domain.LibraryAudio;
import com.lifelab.source.audio.domain.LibraryAudioTag;

import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

public final class LibraryAudioSpecifications {
    private LibraryAudioSpecifications() {
    }

    public static Specification<LibraryAudio> ownedBy(Long accountId) {
        return (root, query, builder) -> builder.equal(root.get("account").get("id"), accountId);
    }

    public static Specification<LibraryAudio> keywordContains(String keyword) {
        return (root, query, builder) -> {
            Subquery<Integer> tagMatch = query.subquery(Integer.class);
            Root<LibraryAudioTag> relation = tagMatch.from(LibraryAudioTag.class);
            tagMatch.select(builder.literal(1)).where(
                    builder.equal(relation.get("libraryAudio"), root),
                    contains(SearchExpressions.normalized(relation.get("tag").get("name"), builder), keyword, builder));
            return builder.or(
                contains(SearchExpressions.normalized(root.get("title"), builder), keyword, builder),
                contains(SearchExpressions.normalized(root.get("personalDescription"), builder), keyword, builder),
                contains(SearchExpressions.normalized(root.get("audioSource").get("originalFilename"), builder), keyword, builder),
                contains(SearchExpressions.normalized(root.get("audioSource").get("externalUrl"), builder), keyword, builder),
                builder.exists(tagMatch));
        };
    }

    public static Specification<LibraryAudio> hasAnyTagId(List<Long> tagIds) {
        return (root, query, builder) -> {
            Subquery<Integer> matching = query.subquery(Integer.class);
            Root<LibraryAudioTag> relation = matching.from(LibraryAudioTag.class);
            matching.select(builder.literal(1)).where(
                    builder.equal(relation.get("libraryAudio"), root),
                    relation.get("tag").get("id").in(tagIds));
            return builder.exists(matching);
        };
    }

    public static Specification<LibraryAudio> hasNotes(Long accountId, boolean hasNotes) {
        return (root, query, builder) -> {
            Subquery<Integer> matching = query.subquery(Integer.class);
            Root<Note> note = matching.from(Note.class);
            matching.select(builder.literal(1)).where(
                    builder.equal(note.get("account").get("id"), accountId),
                    builder.equal(note.get("audioSource"), root.get("audioSource")));
            return hasNotes ? builder.exists(matching) : builder.not(builder.exists(matching));
        };
    }

    public static Specification<LibraryAudio> origin(AudioOrigin origin) {
        return (root, query, builder) -> builder.equal(root.get("audioSource").get("origin"), origin);
    }

    public static Specification<LibraryAudio> addedBetween(LocalDate from, LocalDate to) {
        return (root, query, builder) -> {
            Predicate result = builder.conjunction();
            if (from != null) {
                result = builder.and(result, builder.greaterThanOrEqualTo(
                        root.get("addedAt"), from.atStartOfDay().atOffset(ZoneOffset.UTC)));
            }
            if (to != null) {
                result = builder.and(result, builder.lessThan(
                        root.<OffsetDateTime>get("addedAt"), to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC)));
            }
            return result;
        };
    }

    public static Specification<LibraryAudio> orderedBy(String sortBy, boolean ascending) {
        return (root, query, builder) -> {
            if (Long.class.equals(query.getResultType()) || long.class.equals(query.getResultType())) {
                return builder.conjunction();
            }
            Expression<?> primary = "title".equals(sortBy)
                    ? builder.coalesce(root.<String>get("title"),
                            builder.coalesce(root.get("audioSource").<String>get("originalFilename"),
                                    builder.<String>selectCase()
                                            .when(builder.equal(root.get("audioSource").get("origin"), AudioOrigin.EXTERNAL), "External audio")
                                            .otherwise("Audio")))
                    : root.get("addedAt");
            query.orderBy(
                    ascending ? builder.asc(primary) : builder.desc(primary),
                    ascending ? builder.asc(root.get("id")) : builder.desc(root.get("id")));
            return builder.conjunction();
        };
    }

    private static Predicate contains(Expression<String> value, String keyword, jakarta.persistence.criteria.CriteriaBuilder builder) {
        return builder.greaterThan(builder.locate(value, keyword), 0);
    }
}
