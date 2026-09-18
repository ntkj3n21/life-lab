package com.lifelab.source.image.exception;

import java.util.Map;

public class InvalidImageRequestException extends RuntimeException {

    private final Map<String, String> fieldErrors;

    public InvalidImageRequestException(String field, String message) {
        super("Request validation failed.");
        this.fieldErrors = Map.of(field, message);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
