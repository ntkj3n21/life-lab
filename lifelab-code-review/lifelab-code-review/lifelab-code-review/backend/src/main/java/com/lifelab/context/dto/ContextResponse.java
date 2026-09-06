package com.lifelab.context.dto;

import com.lifelab.context.domain.ContextNavigationMode;
import com.lifelab.note.dto.NoteResponse;
import com.lifelab.task.dto.TaskResponse;

public record ContextResponse(
        ContextNavigationMode navigationMode,
        TaskResponse task,
        NoteResponse note,
        Long libraryVideoId) {
}