package com.lifelab.common.persistence;

import org.hibernate.exception.ConstraintViolationException;

public final class DatabaseConstraintMatcher {

    private DatabaseConstraintMatcher() {
    }

    public static boolean matches(Throwable exception, String constraintName) {
        Throwable cause = exception;

        while (cause != null) {
            if (cause instanceof ConstraintViolationException constraintViolation
                    && constraintName.equalsIgnoreCase(
                            constraintViolation.getConstraintName())) {
                return true;
            }

            cause = cause.getCause();
        }

        return false;
    }
}