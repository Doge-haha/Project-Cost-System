package com.xindian.saaspricing.bill.dto;

import java.util.UUID;

public record BillVersionContext(
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
        UUID sourceVersionId
) {
}
