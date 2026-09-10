package com.lifelab.organization.category.domain;

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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Entity
@Table(
        name = "categories",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_categories_account_normalized_name",
                columnNames = {"account_id", "normalized_name"}
        )
)
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @NotBlank
    @Size(max = 100)
    @Column(nullable = false, length = 100)
    private String name;

    @NotBlank
    @Size(max = 100)
    @Column(name = "normalized_name", nullable = false, length = 100)
    private String normalizedName;

    @NotNull
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected Category() {
    }

    public static Category create(
            Account account,
            String name,
            String normalizedName,
            OffsetDateTime now) {
        if (account == null) {
            throw new NullPointerException("account must not be null");
        }
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must contain meaningful text");
        }
        if (normalizedName == null || normalizedName.isBlank()) {
            throw new IllegalArgumentException("normalizedName must contain meaningful text");
        }
        if (now == null) {
            throw new NullPointerException("now must not be null");
        }

        Category category = new Category();
        category.account = account;
        category.name = name;
        category.normalizedName = normalizedName;
        category.createdAt = now;
        category.updatedAt = now;
        return category;
    }

    public void rename(String name, String normalizedName, OffsetDateTime now) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name must contain meaningful text");
        }
        if (normalizedName == null || normalizedName.isBlank()) {
            throw new IllegalArgumentException("normalizedName must contain meaningful text");
        }
        if (now == null) {
            throw new NullPointerException("now must not be null");
        }

        this.name = name;
        this.normalizedName = normalizedName;
        this.updatedAt = now;
    }

    public Long getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public String getName() {
        return name;
    }

    public String getNormalizedName() {
        return normalizedName;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }
}
