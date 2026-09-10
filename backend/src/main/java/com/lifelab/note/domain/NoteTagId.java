package com.lifelab.note.domain;

import java.io.Serializable;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class NoteTagId implements Serializable {

    @Column(name = "note_id")
    private Long noteId;

    @Column(name = "tag_id")
    private Long tagId;

    protected NoteTagId() {
    }

    NoteTagId(Long noteId, Long tagId) {
        this.noteId = noteId;
        this.tagId = tagId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof NoteTagId that)) {
            return false;
        }
        return Objects.equals(noteId, that.noteId)
                && Objects.equals(tagId, that.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(noteId, tagId);
    }
}
