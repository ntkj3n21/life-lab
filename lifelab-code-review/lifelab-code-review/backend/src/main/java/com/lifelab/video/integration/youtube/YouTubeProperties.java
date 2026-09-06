package com.lifelab.video.integration.youtube;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.youtube")
public record YouTubeProperties(String apiKey) {
}
