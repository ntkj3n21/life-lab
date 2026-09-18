package com.lifelab.source.audio.exception;

public class AudioContentNotFoundException extends RuntimeException {

    public AudioContentNotFoundException() {
        super("Audio content was not found.");
    }
}
