package com.lifelab.common.text;

import java.text.Normalizer;
import java.util.Locale;

public final class SearchKeywordNormalizer {

    private SearchKeywordNormalizer() {
    }

    public static String normalize(String query) {
        if (query == null) {
            return null;
        }

        String stripped = query.strip();
        if (stripped.isEmpty()) {
            return null;
        }

        String decomposed = Normalizer.normalize(stripped.toLowerCase(Locale.ROOT), Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "").replace('đ', 'd');
    }

    public static boolean eligibleForTypoFallback(String keyword) {
        return keyword != null && keyword.matches("[a-z0-9]{4,32}");
    }
}
