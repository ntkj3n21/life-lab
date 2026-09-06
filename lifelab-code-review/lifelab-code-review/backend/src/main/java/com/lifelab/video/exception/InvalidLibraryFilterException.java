package com.lifelab.video.exception;

import java.util.Map;

public class InvalidLibraryFilterException extends RuntimeException {

    private final Map<String, String> fieldErrors;

    public InvalidLibraryFilterException(Map<String, String> fieldErrors) {
        super("Request validation failed.");
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
