package com.xindian.saaspricing.bill.repository;

import com.xindian.saaspricing.bill.dto.BillItemWorkItemResponse;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BillItemWorkItemRepository {

    List<BillItemWorkItemResponse> findByBillItemId(UUID billItemId);

    Optional<BillItemWorkItemResponse> findById(UUID workItemId);

    BillItemWorkItemResponse save(BillItemWorkItemResponse workItem);

    BillItemWorkItemResponse update(BillItemWorkItemResponse workItem);
}
