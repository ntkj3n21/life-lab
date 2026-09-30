package com.lifelab.source.audio.domain;

import com.lifelab.video.domain.Tag;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

@Entity
@Table(name = "library_audio_tags")
public class LibraryAudioTag {
    @EmbeddedId
    private LibraryAudioTagId id;

    @MapsId("libraryAudioId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "library_audio_id", nullable = false)
    private LibraryAudio libraryAudio;

    @MapsId("tagId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false)
    private Tag tag;

    protected LibraryAudioTag() {
    }

    public static LibraryAudioTag create(LibraryAudio audio, Tag tag) {
        LibraryAudioTag relation = new LibraryAudioTag();
        relation.id = new LibraryAudioTagId(audio.getId(), tag.getId());
        relation.libraryAudio = audio;
        relation.tag = tag;
        return relation;
    }

    public LibraryAudio getLibraryAudio() {
        return libraryAudio;
    }

    public Tag getTag() {
        return tag;
    }
}
