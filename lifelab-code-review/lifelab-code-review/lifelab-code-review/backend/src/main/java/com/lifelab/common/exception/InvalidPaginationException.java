package com.lifelab.common.exception;

import java.util.Map;

public class InvalidPaginationException extends RuntimeException {

    private final Map<String, String> fieldErrors;

    public InvalidPaginationException(Map<String, String> fieldErrors) {
        super("Request validation failed.");
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
