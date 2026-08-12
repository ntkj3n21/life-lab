package com.lifelab.video.integration.youtube;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.time.OffsetDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.client.ResponseActions;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import com.lifelab.video.domain.YouTubeAvailabilityStatus;

class YouTubeDataApiClientTest {

    private static final String VIDEO_ID = "video_ID-1";
    private static final String API_KEY = "test-api-key";

    private MockRestServiceServer server;
    private YouTubeDataApiClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new YouTubeDataApiClient(builder, new YouTubeProperties(API_KEY));
    }

    @Test
    void mapsCompleteMetadataToConfirmedCanonicalSource() {
        expectRequest().andRespond(withSuccess("""
                {
                  "items": [{
                    "id": "video_ID-1",
                    "snippet": {
                      "title": "Video title",
                      "channelTitle": "Channel name",
                      "publishedAt": "2024-04-15T09:30:00Z",
                      "thumbnails": {
                        "default": {"url": "https://image/default.jpg"},
                        "high": {"url": "https://image/high.jpg"},
                        "maxres": {"url": "https://image/maxres.jpg"}
                      }
                    },
                    "contentDetails": {"duration": "PT1H2M3S"}
                  }]
                }
                """, MediaType.APPLICATION_JSON));

        ResolvedYouTubeVideo resolved = client.resolve(VIDEO_ID);

        assertThat(resolved.youtubeVideoId()).isEqualTo(VIDEO_ID);
        assertThat(resolved.sourceUrl())
                .isEqualTo("https://www.youtube.com/watch?v=" + VIDEO_ID);
        assertThat(resolved.title()).isEqualTo("Video title");
        assertThat(resolved.channelName()).isEqualTo("Channel name");
        assertThat(resolved.thumbnailUrl()).isEqualTo("https://image/maxres.jpg");
        assertThat(resolved.durationSeconds()).isEqualTo(3723);
        assertThat(resolved.publishedAt()).isEqualTo(OffsetDateTime.parse("2024-04-15T09:30:00Z"));
        assertThat(resolved.availabilityStatus()).isEqualTo(YouTubeAvailabilityStatus.AVAILABLE);
        server.verify();
    }

    @Test
    void selectsFirstAvailableThumbnailByPriority() {
        expectRequest().andRespond(withSuccess("""
                {"items":[{"id":"video_ID-1","snippet":{"thumbnails":{
                  "high":{"url":"https://image/high.jpg"},
                  "standard":{"url":"https://image/standard.jpg"}
                }}}]}
                """, MediaType.APPLICATION_JSON));

        assertThat(client.resolve(VIDEO_ID).thumbnailUrl()).isEqualTo("https://image/standard.jpg");
    }

    @Test
    void leavesMissingOptionalMetadataNull() {
        expectRequest().andRespond(withSuccess(
                "{\"items\":[{\"id\":\"video_ID-1\"}]}",
                MediaType.APPLICATION_JSON));

        ResolvedYouTubeVideo resolved = client.resolve(VIDEO_ID);

        assertThat(resolved.title()).isNull();
        assertThat(resolved.channelName()).isNull();
        assertThat(resolved.thumbnailUrl()).isNull();
        assertThat(resolved.durationSeconds()).isNull();
        assertThat(resolved.publishedAt()).isNull();
    }

    @Test
    void malformedOptionalDurationDoesNotBecomeZero() {
        expectRequest().andRespond(withSuccess("""
                {"items":[{"id":"video_ID-1","contentDetails":{"duration":"not-a-duration"}}]}
                """, MediaType.APPLICATION_JSON));

        assertThat(client.resolve(VIDEO_ID).durationSeconds()).isNull();
    }

    @Test
    void emptyItemListMeansVideoNotFound() {
        expectRequest().andRespond(withSuccess("{\"items\":[]}", MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.resolve(VIDEO_ID))
                .isInstanceOf(YouTubeVideoNotFoundException.class);
    }

    @Test
    void http404MeansVideoNotFound() {
        expectRequest().andRespond(withStatus(HttpStatus.NOT_FOUND));

        assertThatThrownBy(() -> client.resolve(VIDEO_ID))
                .isInstanceOf(YouTubeVideoNotFoundException.class);
    }

    @Test
    void forbiddenQuotaStyleFailureIsServiceFailure() {
        expectRequest().andRespond(withStatus(HttpStatus.FORBIDDEN));

        assertThatThrownBy(() -> client.resolve(VIDEO_ID))
                .isInstanceOf(YouTubeServiceException.class);
    }

    @Test
    void serverFailureIsServiceFailure() {
        expectRequest().andRespond(withServerError());

        assertThatThrownBy(() -> client.resolve(VIDEO_ID))
                .isInstanceOf(YouTubeServiceException.class);
    }

    @Test
    void networkFailureIsServiceFailure() {
        expectRequest().andRespond(withException(new IOException("network unavailable")));

        assertThatThrownBy(() -> client.resolve(VIDEO_ID))
                .isInstanceOf(YouTubeServiceException.class);
    }

    @Test
    void mismatchedReturnedIdIsServiceFailure() {
        expectRequest().andRespond(withSuccess(
                "{\"items\":[{\"id\":\"different-id\"}]}",
                MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.resolve(VIDEO_ID))
                .isInstanceOf(YouTubeServiceException.class);
    }

    @Test
    void missingApiKeyFailsOnlyWhenClientIsInvoked() {
        RestClient.Builder builder = RestClient.builder();
        YouTubeDataApiClient unconfiguredClient =
                new YouTubeDataApiClient(builder, new YouTubeProperties(" "));

        assertThatThrownBy(() -> unconfiguredClient.resolve(VIDEO_ID))
                .isInstanceOf(YouTubeServiceException.class)
                .hasMessage("YouTube API key is not configured.");
    }

    private ResponseActions expectRequest() {
        return server.expect(request -> {
            assertThat(request.getMethod()).isEqualTo(HttpMethod.GET);
            assertThat(request.getURI().getPath()).isEqualTo("/youtube/v3/videos");
            var query = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
            assertThat(query.getFirst("part")).isEqualTo("snippet,contentDetails");
            assertThat(query.getFirst("id")).isEqualTo(VIDEO_ID);
            assertThat(query.getFirst("fields")).contains("items(", "contentDetails(duration)");
            assertThat(query.getFirst("key")).isEqualTo(API_KEY);
        });
    }
}
