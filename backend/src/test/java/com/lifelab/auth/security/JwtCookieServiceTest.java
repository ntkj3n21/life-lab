package com.lifelab.auth.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseCookie;

class JwtCookieServiceTest {

    private final JwtProperties jwtProperties =
            new JwtProperties("life-lab", Duration.ofMinutes(30), "unused-in-cookie-test");

    @Test
    void createsHttpOnlyAccessTokenCookie() {
        JwtCookieService service = new JwtCookieService(jwtProperties, new CookieProperties(true));

        ResponseCookie cookie = service.createAccessTokenCookie("signed-jwt");

        assertThat(cookie.getName()).isEqualTo("lifelab_access_token");
        assertThat(cookie.getValue()).isEqualTo("signed-jwt");
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Lax");
        assertThat(cookie.getPath()).isEqualTo("/");
        assertThat(cookie.getMaxAge()).isEqualTo(Duration.ofMinutes(30));
    }

    @Test
    void createsExpiredCookieWithMatchingSecurityAttributes() {
        JwtCookieService service = new JwtCookieService(jwtProperties, new CookieProperties(false));

        ResponseCookie cookie = service.createExpiredAccessTokenCookie();

        assertThat(cookie.getName()).isEqualTo("lifelab_access_token");
        assertThat(cookie.getValue()).isEmpty();
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isFalse();
        assertThat(cookie.getSameSite()).isEqualTo("Lax");
        assertThat(cookie.getPath()).isEqualTo("/");
        assertThat(cookie.getMaxAge()).isZero();
    }
}
