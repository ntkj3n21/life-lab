package com.lifelab.source.common;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

public final class HttpSourceUrlValidator {

    private HttpSourceUrlValidator() {
    }

    public static String normalize(String value) {
        String normalized = value == null ? "" : value.trim();

        try {
            URI uri = new URI(normalized);
            String scheme = uri.getScheme();
            if (scheme == null
                    || !(scheme.toLowerCase(Locale.ROOT).equals("http")
                    || scheme.toLowerCase(Locale.ROOT).equals("https"))
                    || uri.getHost() == null) {
                throw new IllegalArgumentException("URL must use HTTP or HTTPS.");
            }
            return normalized;
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("URL must be a valid HTTP or HTTPS URL.", exception);
        }
    }
}
