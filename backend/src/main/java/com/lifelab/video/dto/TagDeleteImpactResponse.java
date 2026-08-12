package com.lifelab.video.dto;

public record TagDeleteImpactResponse(
        Long tagId,
        long libraryVideoCountToDetach,
        boolean libraryVideosPreserved) {
}
