package com.xindian.saaspricing.bill.repository;

import com.xindian.saaspricing.bill.dto.BillItemResponse;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BillItemRepository {

    List<BillItemResponse> findByBillVersionId(UUID billVersionId);

    Optional<BillItemResponse> findById(UUID itemId);

    BillItemResponse save(BillItemResponse item);

    BillItemResponse update(BillItemResponse item);
}
