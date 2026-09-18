package com.lifelab.source.image.domain;

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

@Entity
@Table(
        name = "library_images",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_library_images_account_source",
                columnNames = {"account_id", "image_source_id"}))
public class LibraryImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "image_source_id", nullable = false)
    private ImageSource imageSource;

    @NotNull
    @Column(name = "added_at", nullable = false)
    private OffsetDateTime addedAt;

    protected LibraryImage() {
    }

    public static LibraryImage create(Account account, ImageSource imageSource, OffsetDateTime now) {
        LibraryImage image = new LibraryImage();
        image.account = account;
        image.imageSource = imageSource;
        image.addedAt = now;
        return image;
    }

    public Long getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public ImageSource getImageSource() {
        return imageSource;
    }

    public OffsetDateTime getAddedAt() {
        return addedAt;
    }
}
