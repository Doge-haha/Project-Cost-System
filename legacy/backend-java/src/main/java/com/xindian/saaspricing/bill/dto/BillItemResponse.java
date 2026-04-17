package com.xindian.saaspricing.bill.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record BillItemResponse(
        UUID id,
        UUID billVersionId,
        UUID parentId,
        Integer itemLevel,
        Integer sortOrder,
        String itemCode,
        String itemName,
        String unit,
        String sourceBillId,
        Integer sourceSequence,
        String sourceLevelCode,
        Boolean isMeasureItem,
        BigDecimal quantity,
        String featureRuleText,
        BigDecimal sourceReferencePrice,
        String sourceFeeId,
        String measureCategory,
        String measureFeeFlag,
        String measureCategorySubtype,
        BigDecimal systemUnitPrice,
        BigDecimal manualUnitPrice,
        BigDecimal finalUnitPrice,
        BigDecimal systemAmount,
        BigDecimal finalAmount,
        BigDecimal taxRate,
        String sourceVersionLabel,
        String lockStatus,
        String validationStatus,
        String remark
) {
}
