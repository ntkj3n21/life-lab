package com.lifelab.video.dto;

public record TagDeleteImpactResponse(
        Long tagId,
        long libraryVideoCountToDetach,
        long noteCountToDetach,
        long taskCountToDetach,
        boolean libraryVideosPreserved,
        boolean notesPreserved,
        boolean tasksPreserved,
        long libraryImageCountToDetach,
        long libraryAudioCountToDetach,
        boolean libraryImagesPreserved,
        boolean libraryAudioPreserved) {
}
