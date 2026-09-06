package com.lifelab.video.integration.youtube;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

@Component
public class YouTubeUrlParser {

    private static final Set<String> YOUTUBE_HOSTS = Set.of(
            "youtube.com",
            "www.youtube.com",
            "m.youtube.com",
            "music.youtube.com");
    private static final Pattern VIDEO_ID_PATTERN = Pattern.compile("[A-Za-z0-9_-]+");

    public String parse(String sourceUrl) {
        try {
            URI uri = URI.create(sourceUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null
                    || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https"))
                    || host == null) {
                throw new InvalidYouTubeUrlException();
            }

            String normalizedHost = host.toLowerCase(Locale.ROOT);
            String videoId;
            if ("youtu.be".equals(normalizedHost)) {
                videoId = singlePathSegment(uri.getPath(), null);
            } else if (YOUTUBE_HOSTS.contains(normalizedHost)) {
                videoId = parseYouTubeHost(uri);
            } else {
                throw new InvalidYouTubeUrlException();
            }

            if (videoId == null || videoId.isBlank() || !VIDEO_ID_PATTERN.matcher(videoId).matches()) {
                throw new InvalidYouTubeUrlException();
            }
            return videoId;
        } catch (InvalidYouTubeUrlException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new InvalidYouTubeUrlException();
        }
    }

    private String parseYouTubeHost(URI uri) {
        if ("/watch".equals(uri.getPath())) {
            return queryParameter(uri.getRawQuery(), "v");
        }
        for (String prefix : new String[] {"shorts", "embed", "live"}) {
            String videoId = singlePathSegment(uri.getPath(), prefix);
            if (videoId != null) {
                return videoId;
            }
        }
        throw new InvalidYouTubeUrlException();
    }

    private String singlePathSegment(String path, String requiredPrefix) {
        if (path == null) {
            return null;
        }
        String[] segments = path.split("/", -1);
        if (requiredPrefix == null) {
            return segments.length == 2 && segments[0].isEmpty() ? segments[1] : null;
        }
        return segments.length == 3
                && segments[0].isEmpty()
                && requiredPrefix.equals(segments[1])
                ? segments[2]
                : null;
    }

    private String queryParameter(String rawQuery, String name) {
        if (rawQuery == null) {
            return null;
        }
        for (String pair : rawQuery.split("&")) {
            String[] parts = pair.split("=", 2);
            String key = URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            if (name.equals(key)) {
                return parts.length == 2
                        ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8)
                        : null;
            }
        }
        return null;
    }
}
