package com.lifelab.video.domain;

import java.io.Serializable;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class LibraryVideoTagId implements Serializable {

    @Column(name = "library_video_id")
    private Long libraryVideoId;

    @Column(name = "tag_id")
    private Long tagId;

    protected LibraryVideoTagId() {
    }

    LibraryVideoTagId(Long libraryVideoId, Long tagId) {
        this.libraryVideoId = libraryVideoId;
        this.tagId = tagId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof LibraryVideoTagId that)) {
            return false;
        }
        return Objects.equals(libraryVideoId, that.libraryVideoId)
                && Objects.equals(tagId, that.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(libraryVideoId, tagId);
    }
}
