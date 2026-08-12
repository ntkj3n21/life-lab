package com.lifelab.video.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;

import com.lifelab.auth.domain.Account;

class TagTest {

    @Test
    void factoryRetainsAccountNamesAndInitialTimestamps() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-11T12:00:00Z");
        Account account = Account.create("user@example.com", "password-hash", "User", now);

        Tag tag = Tag.create(account, "Data Science", "data science", now);

        assertThat(tag.getId()).isNull();
        assertThat(tag.getAccount()).isSameAs(account);
        assertThat(tag.getName()).isEqualTo("Data Science");
        assertThat(tag.getNormalizedName()).isEqualTo("data science");
        assertThat(tag.getCreatedAt()).isEqualTo(now);
        assertThat(tag.getUpdatedAt()).isEqualTo(now);
    }

    @Test
    void renameChangesOnlyNamesAndUpdatedTimestamp() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-08-11T12:00:00Z");
        OffsetDateTime renamedAt = createdAt.plusMinutes(5);
        Account account = Account.create("user@example.com", "password-hash", "User", createdAt);
        Tag tag = Tag.create(account, "study", "study", createdAt);

        tag.rename("Study Plan", "study plan", renamedAt);

        assertThat(tag.getAccount()).isSameAs(account);
        assertThat(tag.getName()).isEqualTo("Study Plan");
        assertThat(tag.getNormalizedName()).isEqualTo("study plan");
        assertThat(tag.getCreatedAt()).isEqualTo(createdAt);
        assertThat(tag.getUpdatedAt()).isEqualTo(renamedAt);
    }
}
