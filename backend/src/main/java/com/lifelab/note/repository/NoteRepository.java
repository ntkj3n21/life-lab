package com.lifelab.note.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.note.domain.Note;

public interface NoteRepository extends JpaRepository<Note, Long> {

    long countByAccount_IdAndYoutubeSource_Id(Long accountId, Long youtubeSourceId);

    Optional<Note> findByIdAndAccount_Id(Long noteId, Long accountId);

    Page<Note> findAllByAccount_Id(Long accountId, Pageable pageable);

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
}
