package com.lifelab.source.audio.exception;

public class LibraryAudioNotFoundException extends RuntimeException {

    public LibraryAudioNotFoundException() {
        super("The library audio item could not be found.");
    }
}
