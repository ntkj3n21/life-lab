package com.lifelab.common.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import com.lifelab.common.exception.UnauthenticatedException;

class CurrentAccountTest {

    private final CurrentAccount currentAccount = new CurrentAccount();

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returnsNumericJwtSubjectAsAccountId() {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt("42")));

        assertThat(currentAccount.requireAccountId()).isEqualTo(42L);
    }

    @Test
    void rejectsMissingOrWrongAuthenticationPrincipal() {
        assertThatThrownBy(currentAccount::requireAccountId)
                .isInstanceOf(UnauthenticatedException.class);

        SecurityContextHolder.getContext().setAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("user", "password", java.util.List.of()));
        assertThatThrownBy(currentAccount::requireAccountId)
                .isInstanceOf(UnauthenticatedException.class);
    }

    @Test
    void rejectsNonNumericJwtSubject() {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt("not-a-number")));

        assertThatThrownBy(currentAccount::requireAccountId)
                .isInstanceOf(UnauthenticatedException.class);
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject(subject)
                .build();
    }
}
