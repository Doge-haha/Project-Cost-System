package com.xindian.saaspricing.discipline.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ProjectDisciplineResponse(
        UUID id,
        UUID projectId,
        String disciplineCode,
        String standardSetCode,
        Integer sortOrder,
        Boolean isEnabled,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

