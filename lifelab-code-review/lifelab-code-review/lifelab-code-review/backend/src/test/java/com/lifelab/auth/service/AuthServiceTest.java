package com.lifelab.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationServiceException;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.dto.AccountResponse;
import com.lifelab.auth.dto.LoginRequest;
import com.lifelab.auth.dto.RegisterRequest;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.auth.security.AccountUserDetails;
import com.lifelab.auth.security.AccountUserDetailsService;
import com.lifelab.auth.security.JwtService;
import com.lifelab.common.exception.EmailAlreadyExistsException;
import com.lifelab.common.exception.InvalidCredentialsException;

class AuthServiceTest {

    private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-08-11T10:15:30Z");

    private AccountRepository accountRepository;
    private EmailNormalizer emailNormalizer;
    private PasswordEncoder passwordEncoder;
    private AuthenticationManager authenticationManager;
    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        accountRepository = mock(AccountRepository.class);
        emailNormalizer = new EmailNormalizer();
        passwordEncoder = new BCryptPasswordEncoder(4);

        AccountUserDetailsService userDetailsService =
                new AccountUserDetailsService(accountRepository, emailNormalizer);
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        authenticationManager = new ProviderManager(provider);
        jwtService = mock(JwtService.class);

        Clock clock = Clock.fixed(Instant.parse("2026-08-11T10:15:30Z"), ZoneOffset.UTC);
        authService = new AuthService(
                accountRepository,
                emailNormalizer,
                passwordEncoder,
                authenticationManager,
                clock,
                jwtService);
    }

    @Test
    void registrationCanonicalizesFieldsAndEncodesUnchangedPassword() {
        String rawPassword = "  Password123  ";
        when(accountRepository.existsByEmail("user@example.com")).thenReturn(false);
        when(accountRepository.saveAndFlush(any(Account.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AccountResponse response = authService.register(
                new RegisterRequest("  USER@Example.COM  ", rawPassword, "  Life Lab User  "));

        ArgumentCaptor<Account> accountCaptor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).saveAndFlush(accountCaptor.capture());
        Account stored = accountCaptor.getValue();
        assertThat(stored.getEmail()).isEqualTo("user@example.com");
        assertThat(stored.getDisplayName()).isEqualTo("Life Lab User");
        assertThat(stored.getPasswordHash()).isNotEqualTo(rawPassword);
        assertThat(passwordEncoder.matches(rawPassword, stored.getPasswordHash())).isTrue();
        assertThat(stored.getCreatedAt()).isEqualTo(NOW);
        assertThat(stored.getUpdatedAt()).isEqualTo(NOW);
        assertThat(response.email()).isEqualTo("user@example.com");
    }

    @Test
    void duplicateEmailIsRejectedBeforeSave() {
        when(accountRepository.existsByEmail("user@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(
                new RegisterRequest("user@example.com", "Password123", "User")))
                .isInstanceOf(EmailAlreadyExistsException.class);

        verify(accountRepository, never()).saveAndFlush(any(Account.class));
    }

    @Test
    void differentlyCasedDuplicateEmailIsRejectedAfterNormalization() {
        when(accountRepository.existsByEmail("user@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(
                new RegisterRequest("USER@EXAMPLE.COM", "Password123", "User")))
                .isInstanceOf(EmailAlreadyExistsException.class);

        verify(accountRepository).existsByEmail("user@example.com");
    }

    @Test
    void correctCredentialsReturnLoginResult() {
        Account account = account(7L, "user@example.com", "Password123", "User");
        when(accountRepository.findByEmail("user@example.com")).thenReturn(Optional.of(account));
        when(accountRepository.findById(7L)).thenReturn(Optional.of(account));
        when(jwtService.createAccessToken(7L)).thenReturn("signed-jwt");

        LoginResult result = authService.login(
                new LoginRequest("user@example.com", "Password123"));

        assertThat(result.account()).isEqualTo(new AccountResponse(7L, "user@example.com", "User"));
        assertThat(result.accessToken()).isEqualTo("signed-jwt");
    }

    @Test
    void differentlyCasedEmailCanAuthenticate() {
        Account account = account(7L, "user@example.com", "Password123", "User");
        when(accountRepository.findByEmail("user@example.com")).thenReturn(Optional.of(account));
        when(accountRepository.findById(7L)).thenReturn(Optional.of(account));
        when(jwtService.createAccessToken(7L)).thenReturn("signed-jwt");

        LoginResult result = authService.login(
                new LoginRequest("USER@EXAMPLE.COM", "Password123"));

        assertThat(result.account().id()).isEqualTo(7L);
        verify(accountRepository).findByEmail("user@example.com");
    }

    @Test
    void wrongPasswordProducesGenericInvalidCredentialsError() {
        Account account = account(7L, "user@example.com", "Password123", "User");
        when(accountRepository.findByEmail("user@example.com")).thenReturn(Optional.of(account));

        assertThatThrownBy(() -> authService.login(
                new LoginRequest("user@example.com", "WrongPassword")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Email or password is incorrect.");
    }

    @Test
    void unknownEmailProducesSameGenericInvalidCredentialsError() {
        when(accountRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(
                new LoginRequest("unknown@example.com", "Password123")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Email or password is incorrect.");
    }

    @Test
    void authenticationServiceFailurePropagatesWithoutBecomingInvalidCredentials() {
        AuthenticationManager manager = mock(AuthenticationManager.class);
        AuthenticationServiceException failure = new AuthenticationServiceException("Authentication backend unavailable");
        when(manager.authenticate(any(Authentication.class))).thenThrow(failure);
        AuthService service = new AuthService(
                accountRepository,
                emailNormalizer,
                passwordEncoder,
                manager,
                Clock.fixed(NOW.toInstant(), ZoneOffset.UTC),
                jwtService);

        assertThatThrownBy(() -> service.login(
                new LoginRequest("user@example.com", "Password123")))
                .isSameAs(failure);
    }

    @Test
    void authenticationDelegatesCredentialsToAuthenticationManager() {
        AuthenticationManager manager = mock(AuthenticationManager.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        AccountUserDetails principal = new AccountUserDetails(7L, "user@example.com", "hash");
        Authentication authenticated = UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities());
        when(manager.authenticate(any(Authentication.class))).thenReturn(authenticated);
        Account account = Account.create("user@example.com", "hash", "User", NOW);
        ReflectionTestUtils.setField(account, "id", 7L);
        when(accountRepository.findById(7L)).thenReturn(Optional.of(account));
        AuthService service = new AuthService(
                accountRepository,
                emailNormalizer,
                encoder,
                manager,
                Clock.fixed(NOW.toInstant(), ZoneOffset.UTC),
                jwtService);

        when(jwtService.createAccessToken(7L)).thenReturn("signed-jwt");

        service.login(new LoginRequest("USER@example.com", "  Password123  "));

        ArgumentCaptor<Authentication> authenticationCaptor = ArgumentCaptor.forClass(Authentication.class);
        verify(manager).authenticate(authenticationCaptor.capture());
        assertThat(authenticationCaptor.getValue().getName()).isEqualTo("user@example.com");
        assertThat(authenticationCaptor.getValue().getCredentials()).isEqualTo("  Password123  ");
        verify(encoder, never()).matches(any(), any());
    }

    @Test
    void jwtIsCreatedOnlyAfterAuthenticatedAccountIsConfirmed() {
        Account account = account(7L, "user@example.com", "Password123", "User");
        when(accountRepository.findByEmail("user@example.com")).thenReturn(Optional.of(account));
        when(accountRepository.findById(7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(
                new LoginRequest("user@example.com", "Password123")))
                .isInstanceOf(com.lifelab.common.exception.UnauthenticatedException.class);

        verify(jwtService, never()).createAccessToken(any());
    }

    private Account account(Long id, String email, String rawPassword, String displayName) {
        Account account = Account.create(email, passwordEncoder.encode(rawPassword), displayName, NOW);
        ReflectionTestUtils.setField(account, "id", id);
        return account;
    }
}
