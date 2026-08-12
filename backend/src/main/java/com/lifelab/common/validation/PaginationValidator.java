package com.lifelab.common.validation;

import java.util.LinkedHashMap;
import java.util.Map;

import com.lifelab.common.exception.InvalidPaginationException;

public final class PaginationValidator {

    private PaginationValidator() {
    }

    public static void validate(int page, int size) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();

        if (page < 0) {
            fieldErrors.put("page", "must be greater than or equal to 0");
        }

        if (size < 1 || size > 100) {
            fieldErrors.put("size", "must be between 1 and 100");
        }

        if (!fieldErrors.isEmpty()) {
            throw new InvalidPaginationException(fieldErrors);
        }
    }
}