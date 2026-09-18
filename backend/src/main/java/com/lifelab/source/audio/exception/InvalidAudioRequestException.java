package com.lifelab.source.audio.exception;

import java.util.Map;

public class InvalidAudioRequestException extends RuntimeException {

    private final Map<String, String> fieldErrors;

    public InvalidAudioRequestException(String field, String message) {
        super("Request validation failed.");
        this.fieldErrors = Map.of(field, message);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
