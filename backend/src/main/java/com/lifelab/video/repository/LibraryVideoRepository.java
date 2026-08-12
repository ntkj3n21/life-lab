package com.lifelab.video.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.lifelab.video.domain.LibraryVideo;

public interface LibraryVideoRepository
        extends JpaRepository<LibraryVideo, Long>, JpaSpecificationExecutor<LibraryVideo> {

    boolean existsByAccount_IdAndYoutubeSource_Id(Long accountId, Long youtubeSourceId);

    Optional<LibraryVideo> findByAccount_IdAndYoutubeSource_Id(Long accountId, Long youtubeSourceId);

    Optional<LibraryVideo> findByIdAndAccount_Id(Long id, Long accountId);

    Page<LibraryVideo> findAllByAccount_Id(Long accountId, Pageable pageable);

}
