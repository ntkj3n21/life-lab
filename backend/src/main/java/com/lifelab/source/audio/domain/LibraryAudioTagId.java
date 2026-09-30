package com.lifelab.source.audio.domain;

import java.io.Serializable;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class LibraryAudioTagId implements Serializable {
    @Column(name = "library_audio_id")
    private Long libraryAudioId;

    @Column(name = "tag_id")
    private Long tagId;

    protected LibraryAudioTagId() {
    }

    LibraryAudioTagId(Long libraryAudioId, Long tagId) {
        this.libraryAudioId = libraryAudioId;
        this.tagId = tagId;
    }

    @Override
    public boolean equals(Object object) {
        return object instanceof LibraryAudioTagId that
                && Objects.equals(libraryAudioId, that.libraryAudioId)
                && Objects.equals(tagId, that.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(libraryAudioId, tagId);
    }
}
