package com.lifelab.common.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.web.csrf.CsrfException;

import com.lifelab.common.exception.ApiError;

import tools.jackson.databind.ObjectMapper;

class SecurityErrorHandlersTest {

    private ObjectMapper objectMapper;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    @Test
    void authenticationEntryPointWritesUnauthenticatedApiError() throws Exception {
        new ApiAuthenticationEntryPoint(objectMapper).commence(
                request,
                response,
                new BadCredentialsException("hidden"));

        ApiError error = objectMapper.readValue(response.getContentAsByteArray(), ApiError.class);
        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentType()).isEqualTo("application/json");
        assertThat(error).isEqualTo(new ApiError(
                "UNAUTHENTICATED", "Authentication is required.", java.util.Map.of()));
    }

    @Test
    void accessDeniedHandlerWritesCsrfApiError() throws Exception {
        new ApiAccessDeniedHandler(objectMapper).handle(
                request,
                response,
                new CsrfException("hidden"));

        ApiError error = objectMapper.readValue(response.getContentAsByteArray(), ApiError.class);
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(error.code()).isEqualTo("CSRF_INVALID");
        assertThat(error.message()).isEqualTo("CSRF token is missing or invalid.");
        assertThat(error.fieldErrors()).isEmpty();
    }

    @Test
    void accessDeniedHandlerWritesGenericForbiddenApiError() throws Exception {
        new ApiAccessDeniedHandler(objectMapper).handle(
                request,
                response,
                new AccessDeniedException("hidden"));

        ApiError error = objectMapper.readValue(response.getContentAsByteArray(), ApiError.class);
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(error.code()).isEqualTo("FORBIDDEN");
        assertThat(error.message()).isEqualTo("Access is denied.");
        assertThat(error.fieldErrors()).isEmpty();
    }
}
