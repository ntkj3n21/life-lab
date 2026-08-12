package com.lifelab.video.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TagNameNormalizerTest {

    private final TagNameNormalizer normalizer = new TagNameNormalizer();

    @Test
    void displayNameStripsOuterAndCollapsesInnerWhitespaceWhilePreservingCasing() {
        assertThat(normalizer.normalizeDisplayName("  Data    Science "))
                .isEqualTo("Data Science");
        assertThat(normalizer.normalizeDisplayName("\tMy\n  TAG\r "))
                .isEqualTo("My TAG");
    }

    @Test
    void comparisonNameUsesLocaleIndependentLowercase() {
        assertThat(normalizer.normalizeForComparison("Data Science"))
                .isEqualTo("data science");
    }

    @Test
    void equivalentStudyNamesProduceTheSameComparisonValue() {
        assertThat(comparison("Study"))
                .isEqualTo(comparison(" study "))
                .isEqualTo(comparison("STUDY"));
    }

    @Test
    void noBreakSpacesAreRemovedAtEdgesBeforeComparison() {
        String displayName = normalizer.normalizeDisplayName("\u00A0Study\u00A0");

        assertThat(displayName).isEqualTo("Study");
        assertThat(normalizer.normalizeForComparison(displayName)).isEqualTo("study");
    }

    @Test
    void mixedUnicodeWhitespaceIsCollapsedAndRemovedAtEdges() {
        assertThat(normalizer.normalizeDisplayName("\u2003Data\u00A0\u2009Science\u202F"))
                .isEqualTo("Data Science");
    }

    private String comparison(String rawName) {
        return normalizer.normalizeForComparison(normalizer.normalizeDisplayName(rawName));
    }
}
