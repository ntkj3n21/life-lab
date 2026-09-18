package com.lifelab.source.audio.domain;

import java.time.OffsetDateTime;

import com.lifelab.auth.domain.Account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Entity
@Table(
        name = "library_audio",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_library_audio_account_source",
                columnNames = {"account_id", "audio_source_id"}))
public class LibraryAudio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "audio_source_id", nullable = false)
    private AudioSource audioSource;

    @Size(max = 255)
    @Column(length = 255)
    private String title;

    @NotNull
    @Column(name = "added_at", nullable = false)
    private OffsetDateTime addedAt;

    protected LibraryAudio() {
    }

    public static LibraryAudio create(
            Account account,
            AudioSource audioSource,
            String title,
            OffsetDateTime now) {
        LibraryAudio audio = new LibraryAudio();
        audio.account = account;
        audio.audioSource = audioSource;
        audio.title = title;
        audio.addedAt = now;
        return audio;
    }

    public Long getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public AudioSource getAudioSource() {
        return audioSource;
    }

    public String getTitle() {
        return title;
    }

    public OffsetDateTime getAddedAt() {
        return addedAt;
    }
}
