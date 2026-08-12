package com.lifelab.watch.exception;

public class WatchSessionClosedException extends RuntimeException {

    public WatchSessionClosedException() {
        super("The watch session is already closed.");
    }
}
