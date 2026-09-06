package com.lifelab.video.exception;

public class LibraryVideoNotFoundException extends RuntimeException {

    public LibraryVideoNotFoundException() {
        super("The library video could not be found.");
    }
}
