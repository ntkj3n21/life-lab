package com.lifelab.video.repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.data.jpa.domain.Specification;

import com.lifelab.note.domain.Note;
import com.lifelab.video.domain.LibraryVideo;
import com.lifelab.video.domain.LibraryVideoTag;
import com.lifelab.watch.domain.WatchSession;
import com.lifelab.watch.domain.WatchSessionValidityStatus;

import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

public final class LibraryVideoSpecifications {

    private LibraryVideoSpecifications() {
    }

    public static Specification<LibraryVideo> ownedBy(Long accountId) {
        return (root, query, builder) -> builder.equal(root.get("account").get("id"), accountId);
    }

    public static Specification<LibraryVideo> keywordContains(String keyword) {
        return (root, query, builder) -> {
            Path<Object> source = root.get("youtubeSource");
            Subquery<Integer> tagMatch = query.subquery(Integer.class);
            Root<LibraryVideoTag> relation = tagMatch.from(LibraryVideoTag.class);
            tagMatch.select(builder.literal(1)).where(
                    builder.equal(relation.get("libraryVideo"), root),
                    contains(builder.lower(relation.get("tag").get("name")), keyword, builder));
            return builder.or(
                    contains(lowerOrEmpty(source.get("title"), builder), keyword, builder),
                    contains(lowerOrEmpty(source.get("channelName"), builder), keyword, builder),
                    contains(lowerOrEmpty(root.get("customTitle"), builder), keyword, builder),
                    contains(lowerOrEmpty(root.get("personalDescription"), builder), keyword, builder),
                    builder.exists(tagMatch));
        };
    }

    public static Specification<LibraryVideo> durationBetween(Integer minimum, Integer maximum) {
        return (root, query, builder) -> {
            Path<Integer> duration = root.get("youtubeSource").get("durationSeconds");
            Predicate predicate = builder.isNotNull(duration);
            if (minimum != null) {
                predicate = builder.and(predicate, builder.greaterThanOrEqualTo(duration, minimum));
            }
            if (maximum != null) {
                predicate = builder.and(predicate, builder.lessThanOrEqualTo(duration, maximum));
            }
            return predicate;
        };
    }

    public static Specification<LibraryVideo> publishedBetween(LocalDate from, LocalDate to) {
        return (root, query, builder) -> dateRange(
                root.get("youtubeSource").get("publishedAt"), from, to, builder);
    }

    public static Specification<LibraryVideo> addedBetween(LocalDate from, LocalDate to) {
        return (root, query, builder) -> dateRange(root.get("addedAt"), from, to, builder);
    }

    public static Specification<LibraryVideo> hasAnyTagId(List<Long> tagIds) {
        return (root, query, builder) -> {
            Subquery<Integer> tagMatch = query.subquery(Integer.class);
            Root<LibraryVideoTag> relation = tagMatch.from(LibraryVideoTag.class);
            tagMatch.select(builder.literal(1)).where(
                    builder.equal(relation.get("libraryVideo"), root),
                    relation.get("tag").get("id").in(tagIds));
            return builder.exists(tagMatch);
        };
    }

    public static Specification<LibraryVideo> watched(boolean watched) {
        return (root, query, builder) -> {
            Subquery<Integer> validSession = query.subquery(Integer.class);
            Root<WatchSession> session = validSession.from(WatchSession.class);
            validSession.select(builder.literal(1)).where(
                    builder.equal(session.get("libraryVideo"), root),
                    builder.equal(
                            session.get("validityStatus"),
                            WatchSessionValidityStatus.VALID));
            Predicate hasValidSession = builder.exists(validSession);
            return watched ? hasValidSession : builder.not(hasValidSession);
        };
    }

    public static Specification<LibraryVideo> hasNotes(Long accountId, boolean hasNotes) {
        return (root, query, builder) -> {
            Subquery<Integer> matchingNote = query.subquery(Integer.class);
            Root<Note> note = matchingNote.from(Note.class);
            matchingNote.select(builder.literal(1)).where(
                    builder.equal(note.get("account").get("id"), accountId),
                    builder.equal(note.get("youtubeSource"), root.get("youtubeSource")));
            Predicate accountHasNote = builder.exists(matchingNote);
            return hasNotes ? accountHasNote : builder.not(accountHasNote);
        };
    }

    public static Specification<LibraryVideo> orderedBy(String sortBy, boolean ascending) {
        return (root, query, builder) -> {
            if (Long.class.equals(query.getResultType()) || long.class.equals(query.getResultType())) {
                return builder.conjunction();
            }

            Expression<?> primary;
            boolean nullsLast = false;
            switch (sortBy) {
                case "addedAt" -> primary = root.get("addedAt");
                case "duration" -> {
                    primary = root.get("youtubeSource").get("durationSeconds");
                    nullsLast = true;
                }
                case "viewCount" -> primary = validViewCount(root, query, builder);
                case "lastWatchedAt" -> {
                    primary = lastValidWatchTime(root, query, builder);
                    nullsLast = true;
                }
                default -> throw new IllegalArgumentException("Unsupported library video sort field");
            }

            Order primaryOrder = ascending ? builder.asc(primary) : builder.desc(primary);
            Order idOrder = ascending ? builder.asc(root.get("id")) : builder.desc(root.get("id"));
            if (nullsLast) {
                Expression<Integer> nullRank = builder.<Integer>selectCase()
                        .when(builder.isNull(primary), 1)
                        .otherwise(0);
                query.orderBy(builder.asc(nullRank), primaryOrder, idOrder);
            } else {
                query.orderBy(primaryOrder, idOrder);
            }
            return builder.conjunction();
        };
    }

    private static Subquery<Long> validViewCount(
            Root<LibraryVideo> root,
            jakarta.persistence.criteria.CriteriaQuery<?> query,
            jakarta.persistence.criteria.CriteriaBuilder builder) {
        Subquery<Long> validSessions = query.subquery(Long.class);
        Root<WatchSession> session = validSessions.from(WatchSession.class);
        validSessions.select(builder.count(session)).where(
                builder.equal(session.get("libraryVideo"), root),
                builder.equal(session.get("validityStatus"), WatchSessionValidityStatus.VALID));
        return validSessions;
    }

    private static Subquery<OffsetDateTime> lastValidWatchTime(
            Root<LibraryVideo> root,
            jakarta.persistence.criteria.CriteriaQuery<?> query,
            jakarta.persistence.criteria.CriteriaBuilder builder) {
        Subquery<OffsetDateTime> lastWatch = query.subquery(OffsetDateTime.class);
        Root<WatchSession> session = lastWatch.from(WatchSession.class);
        lastWatch.select(builder.greatest(session.<OffsetDateTime>get("startedAt"))).where(
                builder.equal(session.get("libraryVideo"), root),
                builder.equal(session.get("validityStatus"), WatchSessionValidityStatus.VALID));
        return lastWatch;
    }

    private static Expression<String> lowerOrEmpty(Path<String> value, jakarta.persistence.criteria.CriteriaBuilder builder) {
        return builder.lower(builder.coalesce(value, ""));
    }

    private static Predicate contains(
            Expression<String> value,
            String keyword,
            jakarta.persistence.criteria.CriteriaBuilder builder) {
        return builder.greaterThan(builder.locate(value, keyword), 0);
    }

    private static Predicate dateRange(
            Path<OffsetDateTime> value,
            LocalDate from,
            LocalDate to,
            jakarta.persistence.criteria.CriteriaBuilder builder) {
        Predicate predicate = builder.isNotNull(value);
        if (from != null) {
            predicate = builder.and(predicate, builder.greaterThanOrEqualTo(
                    value, from.atStartOfDay().atOffset(ZoneOffset.UTC)));
        }
        if (to != null && !to.equals(LocalDate.MAX)) {
            predicate = builder.and(predicate, builder.lessThan(
                    value, to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC)));
        }
        return predicate;
    }
}
