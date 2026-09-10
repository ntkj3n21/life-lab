package com.lifelab.organization.category.exception;

public class CategoryAlreadyExistsException extends RuntimeException {

    public CategoryAlreadyExistsException() {
        super("An equivalent category already exists.");
    }
}
