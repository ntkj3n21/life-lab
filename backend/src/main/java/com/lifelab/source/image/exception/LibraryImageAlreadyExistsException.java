package com.lifelab.source.image.exception;

public class LibraryImageAlreadyExistsException extends RuntimeException {

    public LibraryImageAlreadyExistsException() {
        super("This image is already in the Library.");
    }
}
