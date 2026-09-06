package com.lifelab.auth.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lifelab.auth.dto.AccountResponse;
import com.lifelab.auth.dto.CsrfResponse;
import com.lifelab.auth.dto.LoginRequest;
import com.lifelab.auth.dto.RegisterRequest;
import com.lifelab.auth.security.JwtCookieService;
import com.lifelab.auth.service.AuthService;
import com.lifelab.auth.service.LoginResult;
import com.lifelab.common.security.CurrentAccount;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtCookieService jwtCookieService;
    private final CookieCsrfTokenRepository csrfTokenRepository;
    private final CurrentAccount currentAccount;
    private final SecurityContextLogoutHandler logoutHandler = new SecurityContextLogoutHandler();

    public AuthController(
            AuthService authService,
            JwtCookieService jwtCookieService,
            CookieCsrfTokenRepository csrfTokenRepository,
            CurrentAccount currentAccount) {
        this.authService = authService;
        this.jwtCookieService = jwtCookieService;
        this.csrfTokenRepository = csrfTokenRepository;
        this.currentAccount = currentAccount;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getToken(), csrfToken.getHeaderName());
    }

    @PostMapping("/register")
    public ResponseEntity<AccountResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AccountResponse> login(
            @Valid @RequestBody LoginRequest loginRequest,
            HttpServletRequest request,
            HttpServletResponse response) {
        LoginResult result = authService.login(loginRequest);
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                jwtCookieService.createAccessTokenCookie(result.accessToken()).toString());
        csrfTokenRepository.saveToken(null, request, response);
        return ResponseEntity.ok(result.account());
    }

    @GetMapping("/me")
    public AccountResponse me() {
        return authService.getCurrentAccount(currentAccount.requireAccountId());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                jwtCookieService.createExpiredAccessTokenCookie().toString());
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        logoutHandler.logout(request, response, authentication);
        csrfTokenRepository.saveToken(null, request, response);
        return ResponseEntity.noContent().build();
    }
}
