package com.lifelab.auth.service;

import java.util.Locale;

import org.springframework.stereotype.Component;

@Component
public class EmailNormalizer {

    public String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
