package com.lifelab.auth.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AccountUserDetailsTest {

    @Test
    void exposesIdentityAndHashWithoutAuthorities() {
        AccountUserDetails userDetails = new AccountUserDetails(42L, "user@example.com", "password-hash");

        assertThat(userDetails.getAccountId()).isEqualTo(42L);
        assertThat(userDetails.getUsername()).isEqualTo("user@example.com");
        assertThat(userDetails.getPassword()).isEqualTo("password-hash");
        assertThat(userDetails.getAuthorities()).isEmpty();
        assertThat(userDetails.isAccountNonExpired()).isTrue();
        assertThat(userDetails.isAccountNonLocked()).isTrue();
        assertThat(userDetails.isCredentialsNonExpired()).isTrue();
        assertThat(userDetails.isEnabled()).isTrue();
    }
}
