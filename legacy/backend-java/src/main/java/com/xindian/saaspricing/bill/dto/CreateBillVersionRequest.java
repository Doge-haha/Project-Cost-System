package com.xindian.saaspricing.bill.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record CreateBillVersionRequest(
        @NotBlank String stageCode,
        @NotBlank String disciplineCode,
        String businessIdentity,
        @NotBlank String versionType,
        UUID sourceVersionId
) {
}
