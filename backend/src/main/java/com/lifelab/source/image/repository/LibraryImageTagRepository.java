package com.lifelab.source.image.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.source.image.domain.LibraryImageTag;
import com.lifelab.source.image.domain.LibraryImageTagId;

public interface LibraryImageTagRepository extends JpaRepository<LibraryImageTag, LibraryImageTagId> {
    boolean existsByLibraryImage_IdAndTag_Id(Long imageId, Long tagId);

    void deleteByLibraryImage_IdAndTag_Id(Long imageId, Long tagId);

    long countByTag_Id(Long tagId);

    @Query("select relation from LibraryImageTag relation join fetch relation.tag where relation.libraryImage.id in :ids order by relation.tag.normalizedName, relation.tag.id")
    List<LibraryImageTag> findWithTagsByLibraryImageIds(@Param("ids") Collection<Long> ids);
}
