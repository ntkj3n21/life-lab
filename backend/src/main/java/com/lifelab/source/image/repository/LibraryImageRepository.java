package com.lifelab.source.image.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lifelab.source.image.domain.LibraryImage;

public interface LibraryImageRepository extends JpaRepository<LibraryImage, Long> {

    boolean existsByAccount_IdAndImageSource_Id(
            Long accountId,
            Long imageSourceId);

    Optional<LibraryImage> findByAccount_IdAndImageSource_Id(
            Long accountId,
            Long imageSourceId);

    Optional<LibraryImage> findByIdAndAccount_Id(
            Long id,
            Long accountId);

    Page<LibraryImage> findAllByAccount_Id(
            Long accountId,
            Pageable pageable);

    @Query("""
            select image
            from LibraryImage image
            where image.account.id = :accountId
              and (
                    lower(coalesce(image.title, ''))
                        like lower(concat('%', :q, '%'))
                 or lower(coalesce(image.imageSource.originalFilename, ''))
                        like lower(concat('%', :q, '%'))
                 or lower(coalesce(image.imageSource.externalUrl, ''))
                        like lower(concat('%', :q, '%'))
              )
            """)
    Page<LibraryImage> searchByAccount(
            @Param("accountId") Long accountId,
            @Param("q") String q,
            Pageable pageable);
}
