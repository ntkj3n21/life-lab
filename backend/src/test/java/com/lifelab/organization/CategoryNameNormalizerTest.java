package com.lifelab.organization;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.lifelab.organization.category.service.CategoryNameNormalizer;

class CategoryNameNormalizerTest {

    private final CategoryNameNormalizer normalizer = new CategoryNameNormalizer();

    @Test
    void normalizesDisplayAndComparisonNamesDeterministically() {
        String display = normalizer.normalizeDisplayName("\u2003Machine\u00A0   Learning\u202F");
        assertThat(display).isEqualTo("Machine Learning");
        assertThat(normalizer.normalizeForComparison(display)).isEqualTo("machine learning");
    }
}
