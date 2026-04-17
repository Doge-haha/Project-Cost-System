package com.xindian.saaspricing.project.dto;

import com.xindian.saaspricing.project.enums.ProjectStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        String projectCode,
        String projectName,
        String projectType,
        String templateName,
        ProjectStatus status,
        UUID ownerUserId,
        UUID defaultPriceVersionId,
        UUID defaultFeeTemplateId,
        String clientName,
        String locationCode,
        String locationText,
        BigDecimal buildingArea,
        String structureType,
        String description,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}

