package com.lifelab.video.dto;

public record LibraryVideoDeleteImpactResponse(
        Long libraryVideoId,
        long watchSessionCountToDelete,
        long tagLinkCountToDelete,
        long noteCountPreserved,
        long taskCountPreserved,
        boolean youtubeSourcePreserved) {
}
