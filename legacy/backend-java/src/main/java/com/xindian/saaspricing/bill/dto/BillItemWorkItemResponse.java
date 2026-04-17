package com.xindian.saaspricing.bill.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BillItemWorkItemResponse(
        UUID id,
        UUID billItemId,
        String sourceSpecCode,
        String sourceBillId,
        Integer sortOrder,
        String workContent,
        OffsetDateTime createdAt
) {
}
