package com.lifelab.video.exception;

public class TagAlreadyExistsException extends RuntimeException {

    public TagAlreadyExistsException() {
        super("An equivalent tag already exists.");
    }
}
