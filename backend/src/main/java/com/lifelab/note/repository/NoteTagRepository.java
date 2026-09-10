package com.lifelab.note.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lifelab.note.domain.NoteTag;
import com.lifelab.note.domain.NoteTagId;

public interface NoteTagRepository extends JpaRepository<NoteTag, NoteTagId> {

    long countByTag_Id(Long tagId);

    List<NoteTag> findAllByNote_IdOrderByTag_NormalizedNameAscTag_IdAsc(Long noteId);

    void deleteAllByNote_Id(Long noteId);
}
