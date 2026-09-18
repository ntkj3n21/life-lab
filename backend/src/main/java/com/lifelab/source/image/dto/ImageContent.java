package com.lifelab.source.image.dto;

import org.springframework.core.io.Resource;

public record ImageContent(Resource resource, String mediaType, long sizeBytes) {
}
