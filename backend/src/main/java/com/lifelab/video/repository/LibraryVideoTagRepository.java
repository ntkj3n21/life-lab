package com.lifelab.video.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lifelab.video.domain.LibraryVideoTag;
import com.lifelab.video.domain.LibraryVideoTagId;

public interface LibraryVideoTagRepository extends JpaRepository<LibraryVideoTag, LibraryVideoTagId> {

    long countByLibraryVideo_Id(Long libraryVideoId);

    long countByTag_Id(Long tagId);

    boolean existsByLibraryVideo_IdAndTag_Id(Long libraryVideoId, Long tagId);

    List<LibraryVideoTag> findAllByLibraryVideo_IdOrderByTag_NormalizedNameAscTag_IdAsc(
            Long libraryVideoId);

    void deleteByLibraryVideo_IdAndTag_Id(Long libraryVideoId, Long tagId);
}
