package com.xindian.saaspricing.project.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record UpdateProjectMembersRequest(
        @NotEmpty List<@Valid Item> items
) {
    public record Item(
            UUID memberId,
            @NotNull UUID userId,
            @NotNull String platformRole,
            @NotEmpty List<String> businessIdentities,
            @NotNull String memberStatus,
            List<ScopeItem> scopes
    ) {
    }

    public record ScopeItem(
            @NotNull String scopeType,
            @NotNull String scopeCode
    ) {
    }
}

