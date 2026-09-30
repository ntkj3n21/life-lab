package com.lifelab.source.image.domain;

import com.lifelab.video.domain.Tag;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

@Entity
@Table(name = "library_image_tags")
public class LibraryImageTag {
    @EmbeddedId
    private LibraryImageTagId id;

    @MapsId("libraryImageId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "library_image_id", nullable = false)
    private LibraryImage libraryImage;

    @MapsId("tagId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false)
    private Tag tag;

    protected LibraryImageTag() {
    }

    public static LibraryImageTag create(LibraryImage image, Tag tag) {
        LibraryImageTag relation = new LibraryImageTag();
        relation.id = new LibraryImageTagId(image.getId(), tag.getId());
        relation.libraryImage = image;
        relation.tag = tag;
        return relation;
    }

    public LibraryImage getLibraryImage() {
        return libraryImage;
    }

    public Tag getTag() {
        return tag;
    }
}
