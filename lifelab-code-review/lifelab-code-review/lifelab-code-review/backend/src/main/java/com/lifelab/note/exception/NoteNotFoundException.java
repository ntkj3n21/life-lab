package com.lifelab.note.exception;

public class NoteNotFoundException extends RuntimeException {

    public NoteNotFoundException() {
        super("Note was not found.");
    }
}
