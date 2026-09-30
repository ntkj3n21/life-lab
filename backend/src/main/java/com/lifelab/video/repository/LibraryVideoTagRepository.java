package com.lifelab.video.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.video.domain.LibraryVideoTag;
import com.lifelab.video.domain.LibraryVideoTagId;

public interface LibraryVideoTagRepository extends JpaRepository<LibraryVideoTag, LibraryVideoTagId> {

    long countByLibraryVideo_Id(Long libraryVideoId);

    long countByTag_Id(Long tagId);

    boolean existsByLibraryVideo_IdAndTag_Id(Long libraryVideoId, Long tagId);

    List<LibraryVideoTag> findAllByLibraryVideo_IdOrderByTag_NormalizedNameAscTag_IdAsc(
            Long libraryVideoId);

    @Query("select relation from LibraryVideoTag relation join fetch relation.tag "
            + "where relation.libraryVideo.id in :ids "
            + "and relation.libraryVideo.account.id = :accountId "
            + "and relation.tag.account.id = :accountId "
            + "order by relation.tag.normalizedName, relation.tag.id")
    List<LibraryVideoTag> findWithTagsByLibraryVideoIds(
            @Param("accountId") Long accountId,
            @Param("ids") Collection<Long> ids);

    void deleteByLibraryVideo_IdAndTag_Id(Long libraryVideoId, Long tagId);
}
