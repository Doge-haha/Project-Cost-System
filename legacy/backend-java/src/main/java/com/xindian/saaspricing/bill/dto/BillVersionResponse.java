package com.xindian.saaspricing.bill.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BillVersionResponse(
        UUID id,
        UUID projectId,
        String stageCode,
        String disciplineCode,
        String businessIdentity,
        Integer versionNo,
        String versionType,
        String versionStatus,
        String lockStatus,
        String sourceStageCode,
        UUID sourceVersionId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
