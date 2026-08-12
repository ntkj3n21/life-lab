package com.lifelab.note.exception;

import java.util.Map;

public class InvalidNoteRequestException extends RuntimeException {

    private final Map<String, String> fieldErrors;

    public InvalidNoteRequestException(Map<String, String> fieldErrors) {
        super("Request validation failed.");
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
