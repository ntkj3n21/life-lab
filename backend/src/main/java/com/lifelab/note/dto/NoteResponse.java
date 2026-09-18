package com.lifelab.note.dto;

import java.time.OffsetDateTime;
import java.util.List;

import com.lifelab.note.domain.Note;
import com.lifelab.note.domain.NoteSourceType;
import com.lifelab.organization.category.dto.CategoryResponse;
import com.lifelab.source.audio.dto.AudioSourceResponse;
import com.lifelab.source.image.dto.ImageSourceResponse;
import com.lifelab.video.dto.TagResponse;
import com.lifelab.video.dto.YouTubeVideoResponse;

public record NoteResponse(
        Long id,
        NoteSourceType sourceType,
        YouTubeVideoResponse youtubeSource,
        ImageSourceResponse imageSource,
        AudioSourceResponse audioSource,
        String content,
        Integer timestampSeconds,
        CategoryResponse category,
        List<TagResponse> tags,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public NoteResponse {
        tags = tags == null ? List.of() : List.copyOf(tags);
    }

    public static NoteResponse from(Note note, List<TagResponse> tags) {
        return new NoteResponse(
                note.getId(),
                note.getSourceType(),
                note.getYoutubeSource() == null
                        ? null
                        : YouTubeVideoResponse.from(note.getYoutubeSource()),
                ImageSourceResponse.from(note.getImageSource()),
                AudioSourceResponse.from(note.getAudioSource()),
                note.getContent(),
                note.getTimestampSeconds(),
                CategoryResponse.from(note.getCategory()),
                tags,
                note.getCreatedAt(),
                note.getUpdatedAt());
    }
}
