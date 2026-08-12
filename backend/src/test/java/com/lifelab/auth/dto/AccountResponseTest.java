package com.lifelab.auth.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;

import org.junit.jupiter.api.Test;

import com.lifelab.auth.domain.Account;

class AccountResponseTest {

    @Test
    void mapsOnlyPublicAccountFields() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-11T10:15:30+07:00");
        Account account = Account.create("user@example.com", "secret-password-hash", "Life Lab User", now);

        AccountResponse response = AccountResponse.from(account);

        assertThat(response.id()).isNull();
        assertThat(response.email()).isEqualTo("user@example.com");
        assertThat(response.displayName()).isEqualTo("Life Lab User");
        assertThat(AccountResponse.class.getRecordComponents())
                .extracting(component -> component.getName())
                .doesNotContain("passwordHash");
    }
}
