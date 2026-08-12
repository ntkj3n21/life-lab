package com.lifelab.auth.service;

import java.time.Clock;
import java.time.OffsetDateTime;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.dto.AccountResponse;
import com.lifelab.auth.dto.LoginRequest;
import com.lifelab.auth.dto.RegisterRequest;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.auth.security.AccountUserDetails;
import com.lifelab.auth.security.JwtService;
import com.lifelab.common.exception.EmailAlreadyExistsException;
import com.lifelab.common.exception.InvalidCredentialsException;
import com.lifelab.common.exception.UnauthenticatedException;

@Service
public class AuthService {

    private static final String EMAIL_UNIQUE_CONSTRAINT = "uk_accounts_email_case_insensitive";

    private final AccountRepository accountRepository;
    private final EmailNormalizer emailNormalizer;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final Clock clock;
    private final JwtService jwtService;

    public AuthService(
            AccountRepository accountRepository,
            EmailNormalizer emailNormalizer,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            Clock clock,
            JwtService jwtService) {
        this.accountRepository = accountRepository;
        this.emailNormalizer = emailNormalizer;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.clock = clock;
        this.jwtService = jwtService;
    }

    @Transactional
    public AccountResponse register(RegisterRequest request) {
        String normalizedEmail = emailNormalizer.normalize(request.email());
        if (accountRepository.existsByEmail(normalizedEmail)) {
            throw new EmailAlreadyExistsException();
        }

        String passwordHash = passwordEncoder.encode(request.password());
        OffsetDateTime now = OffsetDateTime.now(clock);
        Account account = Account.create(normalizedEmail, passwordHash, request.displayName().strip(), now);

        try {
            return AccountResponse.from(accountRepository.saveAndFlush(account));
        } catch (DataIntegrityViolationException exception) {
            if (isEmailUniqueConstraintViolation(exception)) {
                throw new EmailAlreadyExistsException();
            }
            throw exception;
        }
    }

    @Transactional(readOnly = true)
    public LoginResult login(LoginRequest request) {
        String normalizedEmail = emailNormalizer.normalize(request.email());
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(normalizedEmail, request.password()));
        } catch (BadCredentialsException exception) {
            throw new InvalidCredentialsException();
        }

        if (!(authentication.getPrincipal() instanceof AccountUserDetails principal)) {
            throw new UnauthenticatedException();
        }
        AccountResponse account = getCurrentAccount(principal.getAccountId());
        String accessToken = jwtService.createAccessToken(principal.getAccountId());
        return new LoginResult(account, accessToken);
    }

    @Transactional(readOnly = true)
    public AccountResponse getCurrentAccount(Long accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(UnauthenticatedException::new);
        return AccountResponse.from(account);
    }

    private boolean isEmailUniqueConstraintViolation(DataIntegrityViolationException exception) {
        Throwable cause = exception;
        while (cause != null) {
            if (cause instanceof ConstraintViolationException constraintViolation
                    && EMAIL_UNIQUE_CONSTRAINT.equalsIgnoreCase(constraintViolation.getConstraintName())) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }
}
