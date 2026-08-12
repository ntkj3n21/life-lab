package com.lifelab.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EmailNormalizerTest {

    private final EmailNormalizer emailNormalizer = new EmailNormalizer();

    @Test
    void stripsWhitespaceAndLowercasesUsingLocaleIndependentRules() {
        String normalized = emailNormalizer.normalize("  USER@Example.COM  ");

        assertThat(normalized).isEqualTo("user@example.com");
    }
}
