package com.lifelab.common.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import com.lifelab.common.exception.UnauthenticatedException;

@Component
public class CurrentAccount {

    public Long requireAccountId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthentication)) {
            throw new UnauthenticatedException();
        }

        String subject = jwtAuthentication.getToken().getSubject();
        if (subject == null || subject.isBlank()) {
            throw new UnauthenticatedException();
        }
        try {
            return Long.valueOf(subject);
        } catch (NumberFormatException exception) {
            throw new UnauthenticatedException();
        }
    }
}
