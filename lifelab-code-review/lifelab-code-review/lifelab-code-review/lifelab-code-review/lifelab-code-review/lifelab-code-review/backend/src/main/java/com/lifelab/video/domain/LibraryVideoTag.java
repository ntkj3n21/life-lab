package com.lifelab.video.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

@Entity
@Table(name = "library_video_tags")
public class LibraryVideoTag {

    @EmbeddedId
    private LibraryVideoTagId id;

    @MapsId("libraryVideoId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "library_video_id", nullable = false)
    private LibraryVideo libraryVideo;

    @MapsId("tagId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tag_id", nullable = false)
    private Tag tag;

    protected LibraryVideoTag() {
    }

    public static LibraryVideoTag create(LibraryVideo libraryVideo, Tag tag) {
        LibraryVideoTag relation = new LibraryVideoTag();
        relation.id = new LibraryVideoTagId(libraryVideo.getId(), tag.getId());
        relation.libraryVideo = libraryVideo;
        relation.tag = tag;
        return relation;
    }

    public LibraryVideoTagId getId() {
        return id;
    }

    public LibraryVideo getLibraryVideo() {
        return libraryVideo;
    }

    public Tag getTag() {
        return tag;
    }
}
