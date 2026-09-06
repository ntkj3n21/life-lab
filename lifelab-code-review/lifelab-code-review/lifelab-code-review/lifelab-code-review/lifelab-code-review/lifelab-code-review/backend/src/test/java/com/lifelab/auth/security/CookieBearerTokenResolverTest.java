package com.lifelab.auth.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import jakarta.servlet.http.Cookie;

class CookieBearerTokenResolverTest {

    private final CookieBearerTokenResolver resolver = new CookieBearerTokenResolver();

    @Test
    void returnsAccessTokenCookieValue() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(
                new Cookie("another_cookie", "ignored"),
                new Cookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME, "signed-jwt"));

        assertThat(resolver.resolve(request)).isEqualTo("signed-jwt");
    }

    @Test
    void returnsNullWhenCookieIsMissing() {
        assertThat(resolver.resolve(new MockHttpServletRequest())).isNull();
    }

    @Test
    void returnsNullWhenCookieIsBlank() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME, "   "));

        assertThat(resolver.resolve(request)).isNull();
    }
}
