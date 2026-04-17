package com.xindian.saaspricing.bill.dto;

import java.util.List;
import java.util.UUID;

public record BillVersionValidationSummary(
        UUID versionId,
        boolean passed,
        int errorCount,
        int warningCount,
        List<BillVersionValidationIssue> issues
) {
}
