package com.xindian.saaspricing.bill.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateBillItemWorkItemRequest(
        String sourceSpecCode,
        String sourceBillId,
        @NotNull Integer sortOrder,
        @NotBlank String workContent
) {
}
