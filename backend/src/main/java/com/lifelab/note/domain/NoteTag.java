package com.lifelab.note.domain;

import com.lifelab.video.domain.Tag;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

@Entity
@Table(name = "note_tags")
public class NoteTag {

    @EmbeddedId
    private NoteTagId id;

    @MapsId("noteId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "note_id", nullable = false)
    private Note note;

    @MapsId("tagId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false)
    private Tag tag;

    protected NoteTag() {
    }

    public static NoteTag create(Note note, Tag tag) {
        if (note == null) {
            throw new NullPointerException("note must not be null");
        }
        if (tag == null) {
            throw new NullPointerException("tag must not be null");
        }
        NoteTag relation = new NoteTag();
        relation.id = new NoteTagId(note.getId(), tag.getId());
        relation.note = note;
        relation.tag = tag;
        return relation;
    }

    public NoteTagId getId() {
        return id;
    }

    public Note getNote() {
        return note;
    }

    public Tag getTag() {
        return tag;
    }
}
