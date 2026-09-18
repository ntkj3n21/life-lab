package com.lifelab.source.image.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lifelab.source.image.domain.ImageOrigin;
import com.lifelab.source.image.domain.ImageSource;

public interface ImageSourceRepository extends JpaRepository<ImageSource, Long> {

    Optional<ImageSource> findByOriginAndExternalUrl(ImageOrigin origin, String externalUrl);
}
