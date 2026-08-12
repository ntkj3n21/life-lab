package com.lifelab.video.exception;

public class TagNotFoundException extends RuntimeException {

    public TagNotFoundException() {
        super("The tag could not be found.");
    }
}
