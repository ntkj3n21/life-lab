package com.lifelab.task.domain;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import com.lifelab.auth.domain.Account;
import com.lifelab.note.domain.Note;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_note_id")
    private Note sourceNote;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "source_status", nullable = false, columnDefinition = "varchar")
    private TaskSourceStatus sourceStatus;

    @NotBlank
    @Size(max = 255)
    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar")
    private TaskStatus status;

    private LocalDate deadline;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Task() {
    }

    public static Task createIndependent(
            Account account,
            String title,
            String description,
            LocalDate deadline,
            OffsetDateTime now) {
        if (account == null) {
            throw new NullPointerException("account must not be null");
        }
        validateTitle(title);
        if (now == null) {
            throw new NullPointerException("now must not be null");
        }
        Task task = new Task();
        task.account = account;
        task.sourceNote = null;
        task.sourceStatus = TaskSourceStatus.INDEPENDENT;
        task.title = title;
        task.description = description;
        task.status = TaskStatus.NOT_STARTED;
        task.deadline = deadline;
        task.createdAt = now;
        task.updatedAt = now;
        return task;
    }

    public static Task createFromNote(
            Note sourceNote,
            String title,
            String description,
            LocalDate deadline,
            OffsetDateTime now) {
        if (sourceNote == null) {
            throw new NullPointerException("sourceNote must not be null");
        }
        validateTitle(title);
        if (now == null) {
            throw new NullPointerException("now must not be null");
        }
        Task task = new Task();
        task.account = sourceNote.getAccount();
        task.sourceNote = sourceNote;
        task.sourceStatus = TaskSourceStatus.HAS_SOURCE;
        task.title = title;
        task.description = description;
        task.status = TaskStatus.NOT_STARTED;
        task.deadline = deadline;
        task.createdAt = now;
        task.updatedAt = now;
        return task;
    }

    public void markSourceMissing(OffsetDateTime now) {
        if (now == null) {
            throw new NullPointerException("now must not be null");
        }
        this.sourceNote = null;
        this.sourceStatus = TaskSourceStatus.SOURCE_MISSING;
        this.updatedAt = now;
    }

    public void updateDetails(
            String title,
            String description,
            LocalDate deadline,
            OffsetDateTime now) {
        validateTitle(title);
        if (now == null) {
            throw new NullPointerException("now must not be null");
        }
        this.title = title;
        this.description = description;
        this.deadline = deadline;
        this.updatedAt = now;
    }

    public void changeStatus(TaskStatus status, OffsetDateTime now) {
        if (status == null) {
            throw new NullPointerException("status must not be null");
        }
        if (now == null) {
            throw new NullPointerException("now must not be null");
        }
        this.status = status;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public Note getSourceNote() {
        return sourceNote;
    }

    public TaskSourceStatus getSourceStatus() {
        return sourceStatus;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    private static void validateTitle(String title) {
        if (title == null || title.codePoints().allMatch(Task::isWhitespace)) {
            throw new IllegalArgumentException("title must contain meaningful text");
        }
        if (title.length() > 255) {
            throw new IllegalArgumentException("title must not exceed 255 characters");
        }
    }

    private static boolean isWhitespace(int codePoint) {
        return Character.isWhitespace(codePoint) || Character.isSpaceChar(codePoint);
    }
}
