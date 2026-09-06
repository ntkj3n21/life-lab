package com.lifelab.video.integration.youtube;

public class YouTubeServiceException extends RuntimeException {

    public YouTubeServiceException(String message) {
        super(message);
    }

    public YouTubeServiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
