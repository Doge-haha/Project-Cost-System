package com.xindian.saaspricing.bill.dto;

public record BillVersionValidationIssue(
        String code,
        String severity,
        String message,
        String itemCode,
        String itemId
) {
}
