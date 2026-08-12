package com.lifelab.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.context.annotation.Import;

import com.lifelab.TestcontainersConfiguration;
import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.auth.security.JwtCookieService;

import jakarta.servlet.http.Cookie;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {
        "app.security.jwt.secret=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
        "app.security.cookie.secure=false"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthApiIntegrationTest {

    private static final String EMAIL = "user@example.com";
    private static final String PASSWORD = "Password123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtEncoder jwtEncoder;

    @BeforeEach
    void cleanDatabase() {
        accountRepository.deleteAll();
        accountRepository.flush();
    }

    @Test
    void csrfEndpointIssuesReadableCookieAndUnsafeAuthEndpointsRejectMissingToken() throws Exception {
        CsrfExchange csrf = fetchCsrf();
        assertThat(csrf.cookie().isHttpOnly()).isFalse();
        assertThat(csrf.cookie().getPath()).isEqualTo("/");

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(EMAIL)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(EMAIL, PASSWORD)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));

        register(csrf, EMAIL);
        Cookie accessToken = login(fetchCsrf(), EMAIL, PASSWORD).accessToken();
        mockMvc.perform(post("/api/auth/logout").cookie(accessToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    @Test
    void registrationPersistsCanonicalAccountWithoutIssuingAccessToken() throws Exception {
        CsrfExchange csrf = fetchCsrf();

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("USER@Example.COM")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.displayName").value("Life Lab User"))
                .andReturn();

        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        assertThat(body.has("password")).isFalse();
        assertThat(body.has("passwordHash")).isFalse();
        assertThat(body.has("token")).isFalse();
        assertThat(result.getResponse().getCookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME)).isNull();

        Account persisted = accountRepository.findByEmail(EMAIL).orElseThrow();
        assertThat(persisted.getDisplayName()).isEqualTo("Life Lab User");
        assertThat(persisted.getPasswordHash()).isNotEqualTo(PASSWORD);
        assertThat(passwordEncoder.matches(PASSWORD, persisted.getPasswordHash())).isTrue();
    }

    @Test
    void duplicateEmailsAreRejectedRegardlessOfCase() throws Exception {
        CsrfExchange csrf = fetchCsrf();
        register(csrf, EMAIL);

        mockMvc.perform(post("/api/auth/register")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(EMAIL)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));

        mockMvc.perform(post("/api/auth/register")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("USER@EXAMPLE.COM")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
    }

    @Test
    void loginUsesGenericCredentialErrorsAndIssuesOnlyHttpOnlyCookie() throws Exception {
        register(fetchCsrf(), EMAIL);
        CsrfExchange csrf = fetchCsrf();

        mockMvc.perform(post("/api/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(EMAIL, "WrongPassword")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        mockMvc.perform(post("/api/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson("unknown@example.com", PASSWORD)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        LoginExchange login = login(csrf, "USER@EXAMPLE.COM", PASSWORD);
        JsonNode body = objectMapper.readTree(login.response().getContentAsByteArray());
        assertThat(body.get("email").stringValue()).isEqualTo(EMAIL);
        assertThat(body.has("accessToken")).isFalse();
        assertThat(body.has("token")).isFalse();

        String accessCookieHeader = login.response().getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(header -> header.startsWith(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME + "="))
                .findFirst()
                .orElseThrow();
        assertThat(accessCookieHeader).contains("HttpOnly", "Path=/", "SameSite=Lax");
        Cookie invalidatedCsrf = login.response().getCookie("XSRF-TOKEN");
        assertThat(invalidatedCsrf).isNotNull();
        assertThat(invalidatedCsrf.getMaxAge()).isZero();

        CsrfExchange freshCsrf = fetchCsrf(login.accessToken());
        assertThat(freshCsrf.token()).isNotEqualTo(csrf.token());
    }

    @Test
    void currentAccountRequiresValidIssuerAndUnexpiredJwtCookie() throws Exception {
        register(fetchCsrf(), EMAIL);
        Cookie validToken = login(fetchCsrf(), EMAIL, PASSWORD).accessToken();

        mockMvc.perform(get("/api/auth/me").cookie(validToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(EMAIL));

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        mockMvc.perform(get("/api/auth/me")
                        .cookie(new Cookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME, "malformed")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        Long accountId = accountRepository.findByEmail(EMAIL).orElseThrow().getId();
        mockMvc.perform(get("/api/auth/me").cookie(jwtCookie(token(
                        accountId, "life-lab", Instant.now().minusSeconds(7200), Instant.now().minusSeconds(3600)))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/me").cookie(jwtCookie(token(
                        accountId, "wrong-issuer", Instant.now(), Instant.now().plusSeconds(1800)))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutExpiresAuthenticationAndCsrfCookiesWithoutDeletingAccount() throws Exception {
        register(fetchCsrf(), EMAIL);
        LoginExchange login = login(fetchCsrf(), EMAIL, PASSWORD);
        CsrfExchange csrf = fetchCsrf(login.accessToken());

        MvcResult result = mockMvc.perform(post("/api/auth/logout")
                        .cookie(login.accessToken(), csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNoContent())
                .andReturn();

        Cookie expiredAccessToken = result.getResponse().getCookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME);
        assertThat(expiredAccessToken).isNotNull();
        assertThat(expiredAccessToken.getMaxAge()).isZero();
        Cookie expiredCsrf = result.getResponse().getCookie("XSRF-TOKEN");
        assertThat(expiredCsrf).isNotNull();
        assertThat(expiredCsrf.getMaxAge()).isZero();
        assertThat(accountRepository.count()).isEqualTo(1);
    }

    @Test
    void apiRoutesRequireAuthenticationAndDefaultLogoutEndpointIsDisabled() throws Exception {
        mockMvc.perform(get("/api/protected-route"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        mockMvc.perform(get("/logout"))
                .andExpect(status().isNotFound());

        CsrfExchange csrf = fetchCsrf();
        mockMvc.perform(post("/logout")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token()))
                .andExpect(status().isNotFound());
    }

    private CsrfExchange fetchCsrf(Cookie... cookies) throws Exception {
        var request = get("/api/auth/csrf");
        if (cookies.length > 0) {
            request.cookie(cookies);
        }
        MvcResult result = mockMvc.perform(request)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.headerName").value("X-XSRF-TOKEN"))
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsByteArray());
        Cookie csrfCookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertThat(csrfCookie).isNotNull();
        assertThat(body.get("token").stringValue()).isNotBlank();
        return new CsrfExchange(
                csrfCookie,
                csrfCookie.getValue(),
                body.get("headerName").stringValue());
    }

    private void register(CsrfExchange csrf, String email) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson(email)))
                .andExpect(status().isCreated());
    }

    private LoginExchange login(CsrfExchange csrf, String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .cookie(csrf.cookie())
                        .header(csrf.headerName(), csrf.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginJson(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        Cookie accessToken = result.getResponse().getCookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME);
        assertThat(accessToken).isNotNull();
        assertThat(accessToken.isHttpOnly()).isTrue();
        assertThat(accessToken.getPath()).isEqualTo("/");
        return new LoginExchange(accessToken, result.getResponse());
    }

    private String token(Long accountId, String issuer, Instant issuedAt, Instant expiresAt) {
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(accountId.toString())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .build();
        return jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    private Cookie jwtCookie(String token) {
        return new Cookie(JwtCookieService.ACCESS_TOKEN_COOKIE_NAME, token);
    }

    private String registerJson(String email) {
        return """
                {"email":"%s","password":"%s","displayName":"  Life Lab User  "}
                """.formatted(email, PASSWORD);
    }

    private String loginJson(String email, String password) {
        return """
                {"email":"%s","password":"%s"}
                """.formatted(email, password);
    }

    private record CsrfExchange(Cookie cookie, String token, String headerName) {
    }

    private record LoginExchange(Cookie accessToken, MockHttpServletResponse response) {
    }
}
