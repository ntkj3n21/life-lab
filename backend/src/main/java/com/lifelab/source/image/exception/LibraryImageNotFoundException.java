package com.lifelab.source.image.exception;

public class LibraryImageNotFoundException extends RuntimeException {

    public LibraryImageNotFoundException() {
        super("The library image could not be found.");
    }
}
