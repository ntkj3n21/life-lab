package com.lifelab.auth.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

import javax.crypto.SecretKey;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidationException;

import com.lifelab.common.config.SecurityConfig;

class JwtServiceTest {

    private static final Duration TTL = Duration.ofMinutes(30);

    private JwtProperties properties;
    private JwtEncoder encoder;
    private JwtDecoder decoder;

    @BeforeEach
    void setUp() {
        String secret = Base64.getEncoder().encodeToString(new byte[32]);
        properties = new JwtProperties("life-lab", TTL, secret);
        SecurityConfig config = new SecurityConfig();
        SecretKey secretKey = config.jwtSecretKey(properties);
        encoder = config.jwtEncoder(secretKey);
        decoder = config.jwtDecoder(secretKey, properties);
    }

    @Test
    void createsDecodableTokenWithExpectedMetadataAndFixedClock() {
        Instant issuedAt = Instant.now().minusSeconds(5).truncatedTo(ChronoUnit.SECONDS);
        JwtService service = new JwtService(
                encoder,
                properties,
                Clock.fixed(issuedAt, ZoneOffset.UTC));

        Jwt jwt = decoder.decode(service.createAccessToken(42L));

        assertThat(jwt.getSubject()).isEqualTo("42");
        assertThat(jwt.getClaimAsString("iss")).isEqualTo("life-lab");
        assertThat(jwt.getIssuedAt()).isEqualTo(issuedAt);
        assertThat(jwt.getExpiresAt()).isEqualTo(issuedAt.plus(TTL));
        assertThat(jwt.getHeaders().get("alg")).isEqualTo("HS256");
    }

    @Test
    void rejectsTokenWithWrongIssuer() {
        JwtProperties wrongIssuer = new JwtProperties("another-issuer", TTL, properties.secret());
        JwtService service = new JwtService(
                encoder,
                wrongIssuer,
                Clock.systemUTC());

        assertThatThrownBy(() -> decoder.decode(service.createAccessToken(42L)))
                .isInstanceOf(JwtValidationException.class);
    }

    @Test
    void rejectsExpiredToken() {
        JwtService service = new JwtService(
                encoder,
                properties,
                Clock.fixed(Instant.now().minus(Duration.ofHours(1)), ZoneOffset.UTC));

        assertThatThrownBy(() -> decoder.decode(service.createAccessToken(42L)))
                .isInstanceOf(JwtValidationException.class);
    }
}
