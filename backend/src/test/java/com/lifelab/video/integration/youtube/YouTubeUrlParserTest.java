package com.lifelab.video.integration.youtube;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class YouTubeUrlParserTest {

    private final YouTubeUrlParser parser = new YouTubeUrlParser();

    @ParameterizedTest
    @ValueSource(strings = {
            "https://youtube.com/watch?v=video_ID-1",
            "http://www.youtube.com/watch?v=video_ID-1&t=30&list=ignored",
            "https://youtu.be/video_ID-1?si=tracking",
            "https://youtube.com/shorts/video_ID-1?feature=share",
            "https://youtube.com/embed/video_ID-1",
            "https://youtube.com/live/video_ID-1?t=45",
            "https://m.youtube.com/watch?v=video_ID-1",
            "https://music.youtube.com/watch?v=video_ID-1&list=ignored"
    })
    void extractsIdFromSupportedVideoUrls(String sourceUrl) {
        assertThat(parser.parse(sourceUrl)).isEqualTo("video_ID-1");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "not a url",
            "ftp://youtube.com/watch?v=videoId",
            "https://example.com/watch?v=videoId",
            "https://notyoutube.com/watch?v=videoId",
            "https://youtube.com/playlist?list=playlistId",
            "https://youtube.com/channel/channelId",
            "https://youtube.com/@creator",
            "https://youtube.com/results?search_query=topic",
            "https://youtube.com/watch",
            "https://youtube.com/watch?v=",
            "https://youtu.be/",
            "https://youtube.com/shorts/",
            "https://youtube.com/embed/video.id",
            "https://youtu.be/video/id"
    })
    void rejectsUnsupportedOrInvalidUrls(String sourceUrl) {
        assertThatThrownBy(() -> parser.parse(sourceUrl))
                .isInstanceOf(InvalidYouTubeUrlException.class);
    }
}
