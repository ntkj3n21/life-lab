package com.lifelab.video.integration.youtube;

public class YouTubeVideoNotFoundException extends RuntimeException {

    public YouTubeVideoNotFoundException() {
        super("The YouTube video could not be found.");
    }
}
