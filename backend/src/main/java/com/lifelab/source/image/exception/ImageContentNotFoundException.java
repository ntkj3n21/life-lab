package com.lifelab.source.image.exception;

public class ImageContentNotFoundException extends RuntimeException {

    public ImageContentNotFoundException() {
        super("The uploaded image content could not be found.");
    }
}
