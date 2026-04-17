package com.xindian.saaspricing.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateProjectRequest(
        @NotBlank String projectCode,
        @NotBlank String projectName,
        @NotBlank String projectType,
        @NotBlank String templateName,
        @NotNull UUID ownerUserId,
        String clientName,
        String locationCode,
        String locationText,
        BigDecimal buildingArea,
        String structureType,
        UUID defaultPriceVersionId,
        UUID defaultFeeTemplateId,
        String description
) {
}

