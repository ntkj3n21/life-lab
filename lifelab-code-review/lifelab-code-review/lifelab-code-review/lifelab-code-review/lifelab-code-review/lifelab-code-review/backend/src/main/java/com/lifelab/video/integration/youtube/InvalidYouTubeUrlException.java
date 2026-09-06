package com.lifelab.video.integration.youtube;

public class InvalidYouTubeUrlException extends RuntimeException {

    public InvalidYouTubeUrlException() {
        super("The URL is not a supported YouTube video URL.");
    }
}
