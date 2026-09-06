package com.lifelab.note.dto;

public record NoteDeleteImpactResponse(
        Long noteId,
        long taskCountToMarkSourceMissing,
        boolean tasksPreserved,
        boolean youtubeSourcePreserved) {
}
