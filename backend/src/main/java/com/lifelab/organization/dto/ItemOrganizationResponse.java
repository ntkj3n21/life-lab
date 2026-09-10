package com.lifelab.organization.dto;

import java.util.List;

import com.lifelab.organization.category.dto.CategoryResponse;
import com.lifelab.video.dto.TagResponse;

public record ItemOrganizationResponse(
        CategoryResponse category,
        List<TagResponse> tags) {
}
