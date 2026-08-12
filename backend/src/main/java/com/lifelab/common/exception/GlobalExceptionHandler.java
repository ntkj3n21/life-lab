package com.lifelab.common.exception;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.lifelab.note.exception.InvalidNoteRequestException;
import com.lifelab.note.exception.NoteNotFoundException;
import com.lifelab.task.exception.InvalidTaskFilterException;
import com.lifelab.task.exception.TaskNotFoundException;
import com.lifelab.video.exception.LibraryVideoAlreadyExistsException;
import com.lifelab.video.exception.LibraryVideoNotFoundException;
import com.lifelab.video.exception.InvalidLibraryFilterException;
import com.lifelab.video.exception.TagAlreadyExistsException;
import com.lifelab.video.exception.TagNotFoundException;
import com.lifelab.video.integration.youtube.InvalidYouTubeUrlException;
import com.lifelab.video.integration.youtube.YouTubeServiceException;
import com.lifelab.video.integration.youtube.YouTubeVideoNotFoundException;
import com.lifelab.watch.exception.WatchSessionClosedException;
import com.lifelab.watch.exception.WatchSessionNotFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));

        ApiError apiError = new ApiError(
                "VALIDATION_ERROR",
                "Request validation failed.",
                fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(apiError);
    }

    @ExceptionHandler(EmailAlreadyExistsException.class)
    public ResponseEntity<ApiError> handleEmailAlreadyExists(EmailAlreadyExistsException exception) {
        ApiError apiError = new ApiError(
                "EMAIL_ALREADY_EXISTS",
                exception.getMessage(),
                Map.of());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(apiError);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiError> handleInvalidCredentials(InvalidCredentialsException exception) {
        ApiError apiError = new ApiError(
                "INVALID_CREDENTIALS",
                exception.getMessage(),
                Map.of());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(apiError);
    }

    @ExceptionHandler(UnauthenticatedException.class)
    public ResponseEntity<ApiError> handleUnauthenticated(UnauthenticatedException exception) {
        ApiError apiError = new ApiError(
                "UNAUTHENTICATED",
                "Authentication is required.",
                Map.of());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(apiError);
    }

    @ExceptionHandler(InvalidYouTubeUrlException.class)
    public ResponseEntity<ApiError> handleInvalidYouTubeUrl(InvalidYouTubeUrlException exception) {
        return businessError(HttpStatus.BAD_REQUEST, "INVALID_YOUTUBE_URL", exception.getMessage());
    }

    @ExceptionHandler(YouTubeVideoNotFoundException.class)
    public ResponseEntity<ApiError> handleYouTubeVideoNotFound(YouTubeVideoNotFoundException exception) {
        return businessError(HttpStatus.NOT_FOUND, "YOUTUBE_VIDEO_NOT_FOUND", exception.getMessage());
    }

    @ExceptionHandler(LibraryVideoAlreadyExistsException.class)
    public ResponseEntity<ApiError> handleLibraryVideoAlreadyExists(
            LibraryVideoAlreadyExistsException exception) {
        return businessError(
                HttpStatus.CONFLICT,
                "LIBRARY_VIDEO_ALREADY_EXISTS",
                exception.getMessage());
    }

    @ExceptionHandler(YouTubeServiceException.class)
    public ResponseEntity<ApiError> handleYouTubeService(YouTubeServiceException exception) {
        return businessError(HttpStatus.BAD_GATEWAY, "YOUTUBE_SERVICE_ERROR", "YouTube service is unavailable.");
    }

    @ExceptionHandler(LibraryVideoNotFoundException.class)
    public ResponseEntity<ApiError> handleLibraryVideoNotFound(LibraryVideoNotFoundException exception) {
        return businessError(HttpStatus.NOT_FOUND, "LIBRARY_VIDEO_NOT_FOUND", exception.getMessage());
    }

    @ExceptionHandler(InvalidPaginationException.class)
    public ResponseEntity<ApiError> handleInvalidPagination(InvalidPaginationException exception) {
        return ResponseEntity.badRequest().body(new ApiError(
                "VALIDATION_ERROR",
                exception.getMessage(),
                exception.getFieldErrors()));
    }

    @ExceptionHandler(WatchSessionNotFoundException.class)
    public ResponseEntity<ApiError> handleWatchSessionNotFound(WatchSessionNotFoundException exception) {
        return businessError(HttpStatus.NOT_FOUND, "WATCH_SESSION_NOT_FOUND", exception.getMessage());
    }

    @ExceptionHandler(WatchSessionClosedException.class)
    public ResponseEntity<ApiError> handleWatchSessionClosed(WatchSessionClosedException exception) {
        return businessError(HttpStatus.CONFLICT, "WATCH_SESSION_CLOSED", exception.getMessage());
    }

    @ExceptionHandler(TagNotFoundException.class)
    public ResponseEntity<ApiError> handleTagNotFound(TagNotFoundException exception) {
        return businessError(HttpStatus.NOT_FOUND, "TAG_NOT_FOUND", exception.getMessage());
    }

    @ExceptionHandler(TagAlreadyExistsException.class)
    public ResponseEntity<ApiError> handleTagAlreadyExists(TagAlreadyExistsException exception) {
        return businessError(HttpStatus.CONFLICT, "TAG_ALREADY_EXISTS", exception.getMessage());
    }

    @ExceptionHandler(InvalidLibraryFilterException.class)
    public ResponseEntity<ApiError> handleInvalidLibraryFilter(InvalidLibraryFilterException exception) {
        return ResponseEntity.badRequest().body(new ApiError(
                "VALIDATION_ERROR",
                exception.getMessage(),
                exception.getFieldErrors()));
    }

    @ExceptionHandler(InvalidNoteRequestException.class)
    public ResponseEntity<ApiError> handleInvalidNoteRequest(InvalidNoteRequestException exception) {
        return ResponseEntity.badRequest().body(new ApiError(
                "VALIDATION_ERROR",
                exception.getMessage(),
                exception.getFieldErrors()));
    }

    @ExceptionHandler(NoteNotFoundException.class)
    public ResponseEntity<ApiError> handleNoteNotFound(NoteNotFoundException exception) {
        return businessError(HttpStatus.NOT_FOUND, "NOTE_NOT_FOUND", exception.getMessage());
    }

    @ExceptionHandler(TaskNotFoundException.class)
    public ResponseEntity<ApiError> handleTaskNotFound(TaskNotFoundException exception) {
        return businessError(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", exception.getMessage());
    }

    @ExceptionHandler(InvalidTaskFilterException.class)
    public ResponseEntity<ApiError> handleInvalidTaskFilter(InvalidTaskFilterException exception) {
        return ResponseEntity.badRequest().body(new ApiError(
                "VALIDATION_ERROR",
                exception.getMessage(),
                exception.getFieldErrors()));
    }

    private ResponseEntity<ApiError> businessError(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiError(code, message, Map.of()));
    }
}
