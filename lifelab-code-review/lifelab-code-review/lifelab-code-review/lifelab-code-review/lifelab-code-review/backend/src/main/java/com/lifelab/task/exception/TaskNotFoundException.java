package com.lifelab.task.exception;

public class TaskNotFoundException extends RuntimeException {

    public TaskNotFoundException() {
        super("Task was not found.");
    }
}
