package com.xindian.saaspricing.bill.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record CreateBillItemRequest(
        @NotNull UUID billVersionId,
        UUID parentId,
        @NotNull Integer itemLevel,
        @NotNull Integer sortOrder,
        @NotBlank String itemCode,
        @NotBlank String itemName,
        @NotBlank String unit,
        String sourceBillId,
        Integer sourceSequence,
        String sourceLevelCode,
        Boolean isMeasureItem,
        @NotNull BigDecimal quantity,
        String featureRuleText,
        BigDecimal sourceReferencePrice,
        String sourceFeeId,
        String measureCategory,
        String measureFeeFlag,
        String measureCategorySubtype,
        BigDecimal taxRate,
        String remark
) {
}
