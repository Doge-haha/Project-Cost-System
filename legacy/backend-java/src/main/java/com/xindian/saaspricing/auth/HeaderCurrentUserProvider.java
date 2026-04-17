package com.xindian.saaspricing.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Optional;
import java.util.UUID;

@Component
public class HeaderCurrentUserProvider implements CurrentUserProvider {

    private static final String HEADER_NAME = "X-User-Id";

    @Override
    public Optional<UUID> currentUserId() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attributes == null) {
            return Optional.empty();
        }
        HttpServletRequest request = attributes.getRequest();
        String value = request.getHeader(HEADER_NAME);
        if (value == null || value.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(UUID.fromString(value));
    }
}

