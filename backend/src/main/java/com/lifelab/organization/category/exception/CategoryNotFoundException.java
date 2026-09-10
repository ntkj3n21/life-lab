package com.lifelab.organization.category.exception;

public class CategoryNotFoundException extends RuntimeException {

    public CategoryNotFoundException() {
        super("The category could not be found.");
    }
}
