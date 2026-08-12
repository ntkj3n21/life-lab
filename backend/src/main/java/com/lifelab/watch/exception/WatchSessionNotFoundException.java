package com.lifelab.watch.exception;

public class WatchSessionNotFoundException extends RuntimeException {

    public WatchSessionNotFoundException() {
        super("The watch session could not be found.");
    }
}
