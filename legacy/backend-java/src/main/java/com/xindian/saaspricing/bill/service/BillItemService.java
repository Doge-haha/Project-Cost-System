package com.xindian.saaspricing.bill.service;

import com.xindian.saaspricing.bill.dto.BillItemResponse;
import com.xindian.saaspricing.bill.dto.BillItemWorkItemResponse;
import com.xindian.saaspricing.bill.dto.CreateBillItemRequest;
import com.xindian.saaspricing.bill.dto.CreateBillItemWorkItemRequest;
import com.xindian.saaspricing.bill.dto.UpdateBillItemRequest;

import java.util.List;
import java.util.UUID;

public interface BillItemService {

    List<BillItemResponse> listBillItems(UUID projectId, UUID billVersionId);

    BillItemResponse createBillItem(UUID projectId, CreateBillItemRequest request);

    BillItemResponse updateBillItem(UUID projectId, UUID itemId, UpdateBillItemRequest request);

    List<BillItemWorkItemResponse> listWorkItems(UUID projectId, UUID itemId);

    BillItemWorkItemResponse createWorkItem(UUID projectId, UUID itemId, CreateBillItemWorkItemRequest request);

    BillItemWorkItemResponse updateWorkItem(UUID projectId, UUID itemId, UUID workItemId, CreateBillItemWorkItemRequest request);
}
