package com.lifelab.video.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lifelab.video.domain.YouTubeVideo;

public interface YouTubeVideoRepository extends JpaRepository<YouTubeVideo, Long> {

    Optional<YouTubeVideo> findByYoutubeVideoId(String youtubeVideoId);
}
