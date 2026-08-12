package com.lifelab.task.exception;

import java.util.Map;

public class InvalidTaskFilterException extends RuntimeException {

    private final Map<String, String> fieldErrors;

    public InvalidTaskFilterException(Map<String, String> fieldErrors) {
        super("Task filter validation failed.");
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
