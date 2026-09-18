package com.lifelab.source.audio.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lifelab.source.audio.domain.AudioSource;
import com.lifelab.source.audio.domain.AudioOrigin;

public interface AudioSourceRepository extends JpaRepository<AudioSource, Long> {

    Optional<AudioSource> findByOriginAndExternalUrl(AudioOrigin origin, String externalUrl);
}
