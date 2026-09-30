package com.lifelab.source.image.domain;

import java.io.Serializable;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class LibraryImageTagId implements Serializable {
    @Column(name = "library_image_id")
    private Long libraryImageId;

    @Column(name = "tag_id")
    private Long tagId;

    protected LibraryImageTagId() {
    }

    LibraryImageTagId(Long libraryImageId, Long tagId) {
        this.libraryImageId = libraryImageId;
        this.tagId = tagId;
    }

    @Override
    public boolean equals(Object object) {
        return object instanceof LibraryImageTagId that
                && Objects.equals(libraryImageId, that.libraryImageId)
                && Objects.equals(tagId, that.tagId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(libraryImageId, tagId);
    }
}
