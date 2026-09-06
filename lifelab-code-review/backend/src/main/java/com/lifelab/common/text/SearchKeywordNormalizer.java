package com.lifelab.common.text;

import java.util.Locale;

public final class SearchKeywordNormalizer {

    private SearchKeywordNormalizer() {
    }

    public static String normalize(String query) {
        if (query == null) {
            return null;
        }

        String stripped = query.strip();
        return stripped.isEmpty()
                ? null
                : stripped.toLowerCase(Locale.ROOT);
    }
}