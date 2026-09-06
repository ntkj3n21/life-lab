package com.lifelab.video.integration.youtube;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.lifelab.video.domain.YouTubeAvailabilityStatus;

import tools.jackson.databind.JsonNode;

@Component
public class YouTubeDataApiClient implements YouTubeMetadataClient {

    private static final String BASE_URL = "https://www.googleapis.com";
    private static final String VIDEOS_PATH = "/youtube/v3/videos";
    private static final String RESPONSE_FIELDS = "items(id,snippet(title,channelTitle,thumbnails,publishedAt),"
            + "contentDetails(duration))";
    private static final List<String> THUMBNAIL_PREFERENCE =
            List.of("maxres", "standard", "high", "medium", "default");

    private final RestClient restClient;
    private final YouTubeProperties properties;

    public YouTubeDataApiClient(RestClient.Builder restClientBuilder, YouTubeProperties properties) {
        this.restClient = restClientBuilder.baseUrl(BASE_URL).build();
        this.properties = properties;
    }

    @Override
    public ResolvedYouTubeVideo resolve(String youtubeVideoId) {
        String apiKey = properties.apiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new YouTubeServiceException("YouTube API key is not configured.");
        }

        JsonNode response;
        try {
            response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path(VIDEOS_PATH)
                            .queryParam("part", "snippet,contentDetails")
                            .queryParam("id", youtubeVideoId)
                            .queryParam("fields", RESPONSE_FIELDS)
                            .queryParam("key", apiKey)
                            .build())
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpClientErrorException exception) {
            if (exception.getStatusCode() == HttpStatus.NOT_FOUND) {
                throw new YouTubeVideoNotFoundException();
            }
            throw new YouTubeServiceException("YouTube API request failed.", exception);
        } catch (RestClientException exception) {
            throw new YouTubeServiceException("YouTube API request failed.", exception);
        }

        JsonNode items = response == null ? null : response.get("items");
        if (items == null || !items.isArray()) {
            throw new YouTubeServiceException("YouTube API returned an unverifiable response.");
        }
        if (items.isEmpty()) {
            throw new YouTubeVideoNotFoundException();
        }
        if (items.size() != 1) {
            throw new YouTubeServiceException("YouTube API returned an unverifiable response.");
        }

        JsonNode item = items.get(0);
        String returnedId = text(item, "id");
        if (!youtubeVideoId.equals(returnedId)) {
            throw new YouTubeServiceException("YouTube API returned a mismatched video source.");
        }

        return new ResolvedYouTubeVideo(
                youtubeVideoId,
                "https://www.youtube.com/watch?v=" + youtubeVideoId,
                text(item, "snippet", "title"),
                text(item, "snippet", "channelTitle"),
                preferredThumbnail(item),
                parseDuration(text(item, "contentDetails", "duration")),
                parsePublishedAt(text(item, "snippet", "publishedAt")),
                YouTubeAvailabilityStatus.AVAILABLE);
    }

    private String preferredThumbnail(JsonNode item) {
        for (String quality : THUMBNAIL_PREFERENCE) {
            String url = text(item, "snippet", "thumbnails", quality, "url");
            if (url != null) {
                return url;
            }
        }
        return null;
    }

    private Integer parseDuration(String value) {
        if (value == null) {
            return null;
        }
        try {
            long seconds = Duration.parse(value).getSeconds();
            return seconds >= 0 ? Math.toIntExact(seconds) : null;
        } catch (ArithmeticException | DateTimeException exception) {
            return null;
        }
    }

    private OffsetDateTime parsePublishedAt(String value) {
        if (value == null) {
            return null;
        }
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeException exception) {
            return null;
        }
    }

    private String text(JsonNode root, String... path) {
        JsonNode current = root;
        for (String segment : path) {
            if (current == null || !current.isObject()) {
                return null;
            }
            current = current.get(segment);
        }
        if (current == null || !current.isString()) {
            return null;
        }
        String value = current.stringValue();
        return value == null || value.isBlank() ? null : value;
    }
}
