package com.lifelab.auth.security;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Validated
@ConfigurationProperties(prefix = "app.security.jwt")
public record JwtProperties(
        @NotBlank String issuer,
        @NotNull Duration accessTokenTtl,
        @NotBlank String secret) {

    @AssertTrue(message = "access token TTL must be positive")
    public boolean isAccessTokenTtlPositive() {
        return accessTokenTtl == null || (!accessTokenTtl.isZero() && !accessTokenTtl.isNegative());
    }
}
