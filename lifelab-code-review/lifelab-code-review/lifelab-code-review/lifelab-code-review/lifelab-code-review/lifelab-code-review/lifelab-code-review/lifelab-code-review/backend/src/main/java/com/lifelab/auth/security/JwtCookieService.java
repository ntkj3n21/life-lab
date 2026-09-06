package com.lifelab.auth.security;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
public class JwtCookieService {

    public static final String ACCESS_TOKEN_COOKIE_NAME = "lifelab_access_token";

    private final JwtProperties jwtProperties;
    private final CookieProperties cookieProperties;

    public JwtCookieService(JwtProperties jwtProperties, CookieProperties cookieProperties) {
        this.jwtProperties = jwtProperties;
        this.cookieProperties = cookieProperties;
    }

    public ResponseCookie createAccessTokenCookie(String token) {
        return cookieBuilder(token)
                .maxAge(jwtProperties.accessTokenTtl())
                .build();
    }

    public ResponseCookie createExpiredAccessTokenCookie() {
        return cookieBuilder("")
                .maxAge(0)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder cookieBuilder(String value) {
        return ResponseCookie.from(ACCESS_TOKEN_COOKIE_NAME, value)
                .httpOnly(true)
                .secure(cookieProperties.secure())
                .sameSite("Lax")
                .path("/");
    }
}
