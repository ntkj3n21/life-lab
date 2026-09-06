package com.lifelab.auth.service;

import com.lifelab.auth.dto.AccountResponse;

public record LoginResult(AccountResponse account, String accessToken) {
}
