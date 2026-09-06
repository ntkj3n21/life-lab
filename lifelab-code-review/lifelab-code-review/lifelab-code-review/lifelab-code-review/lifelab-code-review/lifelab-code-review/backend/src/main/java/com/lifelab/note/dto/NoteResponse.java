package com.lifelab.note.dto;

import java.time.OffsetDateTime;

import com.lifelab.note.domain.Note;
import com.lifelab.video.dto.YouTubeVideoResponse;

public record NoteResponse(
        Long id,
        YouTubeVideoResponse youtubeSource,
        String content,
        Integer timestampSeconds,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static NoteResponse from(Note note) {
        return new NoteResponse(
                note.getId(),
                YouTubeVideoResponse.from(note.getYoutubeSource()),
                note.getContent(),
                note.getTimestampSeconds(),
                note.getCreatedAt(),
                note.getUpdatedAt());
    }
}
