package com.lifelab.auth.dto;

public record CsrfResponse(String token, String headerName) {
}
