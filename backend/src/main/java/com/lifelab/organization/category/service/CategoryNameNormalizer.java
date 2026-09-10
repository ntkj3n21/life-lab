package com.lifelab.organization.category.service;

import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

@Component
public class CategoryNameNormalizer {

    private static final Pattern CONSECUTIVE_WHITESPACE =
            Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);

    public String normalizeDisplayName(String rawName) {
        return CONSECUTIVE_WHITESPACE.matcher(rawName).replaceAll(" ").strip();
    }

    public String normalizeForComparison(String displayName) {
        return displayName.toLowerCase(Locale.ROOT);
    }
}
