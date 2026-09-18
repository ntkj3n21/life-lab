package com.lifelab.note.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.note.domain.NoteTag;
import com.lifelab.note.domain.NoteTagId;

public interface NoteTagRepository extends JpaRepository<NoteTag, NoteTagId> {

    long countByTag_Id(Long tagId);

    List<NoteTag> findAllByNote_IdOrderByTag_NormalizedNameAscTag_IdAsc(Long noteId);

    @Query("""
            SELECT noteTag
            FROM NoteTag noteTag
            JOIN FETCH noteTag.tag tag
            WHERE noteTag.note.id IN :noteIds
            ORDER BY noteTag.note.id ASC, tag.normalizedName ASC, tag.id ASC
            """)
    List<NoteTag> findAllWithTagByNoteIdIn(@Param("noteIds") Collection<Long> noteIds);

    void deleteAllByNote_Id(Long noteId);
}
