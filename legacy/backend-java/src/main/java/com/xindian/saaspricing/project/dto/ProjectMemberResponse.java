package com.xindian.saaspricing.project.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record ProjectMemberResponse(
        UUID id,
        UUID projectId,
        UUID userId,
        String platformRole,
        List<String> businessIdentities,
        String memberStatus,
        List<RoleScopeResponse> scopes,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public record RoleScopeResponse(
            String scopeType,
            String scopeCode
    ) {
    }
}

