package com.lifelab.video.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lifelab.video.domain.Tag;

public interface TagRepository extends JpaRepository<Tag, Long> {

    Optional<Tag> findByIdAndAccount_Id(Long tagId, Long accountId);

    Optional<Tag> findByAccount_IdAndNormalizedName(Long accountId, String normalizedName);

    List<Tag> findAllByAccount_IdOrderByNormalizedNameAscIdAsc(Long accountId);
}
