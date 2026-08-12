package com.lifelab.auth.dto;

import com.lifelab.auth.domain.Account;

public record AccountResponse(Long id, String email, String displayName) {

    public static AccountResponse from(Account account) {
        return new AccountResponse(account.getId(), account.getEmail(), account.getDisplayName());
    }
}
