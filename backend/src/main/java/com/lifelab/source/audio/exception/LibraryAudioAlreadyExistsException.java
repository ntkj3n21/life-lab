package com.lifelab.source.audio.exception;

public class LibraryAudioAlreadyExistsException extends RuntimeException {

    public LibraryAudioAlreadyExistsException() {
        super("This audio source is already in the Library.");
    }
}
