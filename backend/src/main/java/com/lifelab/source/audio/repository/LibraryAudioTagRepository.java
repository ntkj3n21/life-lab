package com.lifelab.source.audio.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.source.audio.domain.LibraryAudioTag;
import com.lifelab.source.audio.domain.LibraryAudioTagId;

public interface LibraryAudioTagRepository extends JpaRepository<LibraryAudioTag, LibraryAudioTagId> {
    boolean existsByLibraryAudio_IdAndTag_Id(Long audioId, Long tagId);

    void deleteByLibraryAudio_IdAndTag_Id(Long audioId, Long tagId);

    long countByTag_Id(Long tagId);

    @Query("select relation from LibraryAudioTag relation join fetch relation.tag where relation.libraryAudio.id in :ids order by relation.tag.normalizedName, relation.tag.id")
    List<LibraryAudioTag> findWithTagsByLibraryAudioIds(@Param("ids") Collection<Long> ids);
}
