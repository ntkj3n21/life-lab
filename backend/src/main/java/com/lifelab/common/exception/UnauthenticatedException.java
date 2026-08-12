package com.lifelab.common.exception;

public class UnauthenticatedException extends RuntimeException {

    public UnauthenticatedException() {
        super("Authenticated account is unavailable.");
    }
}
