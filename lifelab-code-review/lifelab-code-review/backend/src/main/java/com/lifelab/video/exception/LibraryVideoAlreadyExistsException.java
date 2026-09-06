package com.lifelab.video.exception;

public class LibraryVideoAlreadyExistsException extends RuntimeException {

    public LibraryVideoAlreadyExistsException() {
        super("This video is already in your library.");
    }
}
