package com.xindian.saaspricing.bill.dto;

import java.math.BigDecimal;

public record UpdateBillItemRequest(
        String itemCode,
        String itemName,
        String unit,
        String sourceLevelCode,
        Boolean isMeasureItem,
        BigDecimal quantity,
        String featureRuleText,
        BigDecimal sourceReferencePrice,
        BigDecimal manualUnitPrice,
        BigDecimal taxRate,
        String measureCategory,
        String measureFeeFlag,
        String measureCategorySubtype,
        String remark
) {
}
