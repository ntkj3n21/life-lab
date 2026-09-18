package com.lifelab.source.audio.dto;

import org.springframework.core.io.Resource;

public record AudioContent(Resource resource, String mediaType, long sizeBytes) {
}
