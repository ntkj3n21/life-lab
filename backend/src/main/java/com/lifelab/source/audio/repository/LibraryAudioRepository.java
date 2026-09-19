package com.lifelab.source.audio.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.source.audio.domain.LibraryAudio;

public interface LibraryAudioRepository extends JpaRepository<LibraryAudio, Long> {

    boolean existsByAccount_IdAndAudioSource_Id(
            Long accountId,
            Long audioSourceId);

    Optional<LibraryAudio> findByAccount_IdAndAudioSource_Id(
            Long accountId,
            Long audioSourceId);

    Optional<LibraryAudio> findByIdAndAccount_Id(
            Long id,
            Long accountId);

    Page<LibraryAudio> findAllByAccount_Id(
            Long accountId,
            Pageable pageable);

    @Query("""
            select audio
            from LibraryAudio audio
            where audio.account.id = :accountId
              and (
                    lower(coalesce(audio.title, ''))
                        like lower(concat('%', :q, '%'))
                 or lower(coalesce(audio.audioSource.originalFilename, ''))
                        like lower(concat('%', :q, '%'))
                 or lower(coalesce(audio.audioSource.externalUrl, ''))
                        like lower(concat('%', :q, '%'))
              )
            """)
    Page<LibraryAudio> searchByAccount(
            @Param("accountId") Long accountId,
            @Param("q") String q,
            Pageable pageable);
}
