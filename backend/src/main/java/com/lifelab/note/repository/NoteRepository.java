package com.lifelab.note.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.note.domain.Note;

public interface NoteRepository extends JpaRepository<Note, Long>, JpaSpecificationExecutor<Note> {

    long countByAccount_IdAndYoutubeSource_Id(Long accountId, Long youtubeSourceId);

    long countByAccount_IdAndCategory_Id(Long accountId, Long categoryId);

    boolean existsByAccount_IdAndImageSource_Id(Long accountId, Long imageSourceId);

    boolean existsByAccount_IdAndAudioSource_Id(Long accountId, Long audioSourceId);

    @EntityGraph(attributePaths = {"youtubeSource", "imageSource", "audioSource", "category"})
    Optional<Note> findByIdAndAccount_Id(Long noteId, Long accountId);

    @EntityGraph(attributePaths = {"youtubeSource", "imageSource", "audioSource", "category"})
    Page<Note> findAllByAccount_Id(Long accountId, Pageable pageable);

    @Override
    @EntityGraph(attributePaths = {"youtubeSource", "imageSource", "audioSource", "category"})
    Page<Note> findAll(Specification<Note> specification, Pageable pageable);

    @EntityGraph(attributePaths = {"youtubeSource", "imageSource", "audioSource", "category"})
    @Query("""
            SELECT note
            FROM Note note
            WHERE note.account.id = :accountId
              AND LOCATE(:keyword, LOWER(note.content)) > 0
            """)
    Page<Note> searchByContent(
            @Param("accountId") Long accountId,
            @Param("keyword") String keyword,
            Pageable pageable);

    @EntityGraph(attributePaths = {"youtubeSource", "imageSource", "audioSource", "category"})
    @Query("""
            SELECT note
            FROM Note note
            WHERE note.account.id = :accountId
              AND note.youtubeSource.id = :youtubeSourceId
            ORDER BY
              CASE WHEN note.timestampSeconds IS NULL THEN 1 ELSE 0 END ASC,
              note.timestampSeconds ASC,
              note.id ASC
            """)
    List<Note> findVideoNotes(
            @Param("accountId") Long accountId,
            @Param("youtubeSourceId") Long youtubeSourceId);

    @EntityGraph(attributePaths = {"youtubeSource", "imageSource", "audioSource", "category"})
    @Query("""
            SELECT note
            FROM Note note
            WHERE note.account.id = :accountId
              AND note.imageSource.id = :imageSourceId
            ORDER BY note.createdAt DESC, note.id DESC
            """)
    List<Note> findImageNotes(
            @Param("accountId") Long accountId,
            @Param("imageSourceId") Long imageSourceId);

    @EntityGraph(attributePaths = {"youtubeSource", "imageSource", "audioSource", "category"})
    @Query("""
            SELECT note
            FROM Note note
            WHERE note.account.id = :accountId
              AND note.audioSource.id = :audioSourceId
            ORDER BY
              CASE WHEN note.timestampSeconds IS NULL THEN 1 ELSE 0 END ASC,
              note.timestampSeconds ASC,
              note.id ASC
            """)
    List<Note> findAudioNotes(
            @Param("accountId") Long accountId,
            @Param("audioSourceId") Long audioSourceId);
}
