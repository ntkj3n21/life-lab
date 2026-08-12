package com.lifelab.auth.security;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.lifelab.auth.domain.Account;
import com.lifelab.auth.repository.AccountRepository;
import com.lifelab.auth.service.EmailNormalizer;

@Service
public class AccountUserDetailsService implements UserDetailsService {

    private final AccountRepository accountRepository;
    private final EmailNormalizer emailNormalizer;

    public AccountUserDetailsService(AccountRepository accountRepository, EmailNormalizer emailNormalizer) {
        this.accountRepository = accountRepository;
        this.emailNormalizer = emailNormalizer;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        String normalizedEmail = emailNormalizer.normalize(username);
        Account account = accountRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials."));
        return new AccountUserDetails(account.getId(), account.getEmail(), account.getPasswordHash());
    }
}
