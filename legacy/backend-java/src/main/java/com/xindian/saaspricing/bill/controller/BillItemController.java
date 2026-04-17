package com.xindian.saaspricing.bill.controller;

import com.xindian.saaspricing.bill.dto.BillItemResponse;
import com.xindian.saaspricing.bill.dto.BillItemWorkItemResponse;
import com.xindian.saaspricing.bill.dto.CreateBillItemRequest;
import com.xindian.saaspricing.bill.dto.CreateBillItemWorkItemRequest;
import com.xindian.saaspricing.bill.dto.UpdateBillItemRequest;
import com.xindian.saaspricing.bill.service.BillItemService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{id}/bill-items")
public class BillItemController {

    private final BillItemService billItemService;

    public BillItemController(BillItemService billItemService) {
        this.billItemService = billItemService;
    }

    @GetMapping
    public Map<String, List<BillItemResponse>> listBillItems(@PathVariable UUID id, @RequestParam UUID billVersionId) {
        return Map.of("items", billItemService.listBillItems(id, billVersionId));
    }

    @PostMapping
    public ResponseEntity<BillItemResponse> createBillItem(@PathVariable UUID id, @Valid @RequestBody CreateBillItemRequest request) {
        BillItemResponse response = billItemService.createBillItem(id, request);
        return ResponseEntity.created(URI.create("/api/v1/projects/" + id + "/bill-items/" + response.id())).body(response);
    }

    @PutMapping("/{itemId}")
    public BillItemResponse updateBillItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @RequestBody UpdateBillItemRequest request
    ) {
        return billItemService.updateBillItem(id, itemId, request);
    }

    @GetMapping("/{itemId}/work-items")
    public Map<String, List<BillItemWorkItemResponse>> listWorkItems(@PathVariable UUID id, @PathVariable UUID itemId) {
        return Map.of("items", billItemService.listWorkItems(id, itemId));
    }

    @PostMapping("/{itemId}/work-items")
    public ResponseEntity<BillItemWorkItemResponse> createWorkItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @Valid @RequestBody CreateBillItemWorkItemRequest request
    ) {
        BillItemWorkItemResponse response = billItemService.createWorkItem(id, itemId, request);
        return ResponseEntity.created(URI.create("/api/v1/projects/" + id + "/bill-items/" + itemId + "/work-items/" + response.id())).body(response);
    }

    @PutMapping("/{itemId}/work-items/{workItemId}")
    public BillItemWorkItemResponse updateWorkItem(
            @PathVariable UUID id,
            @PathVariable UUID itemId,
            @PathVariable UUID workItemId,
            @RequestBody CreateBillItemWorkItemRequest request
    ) {
        return billItemService.updateWorkItem(id, itemId, workItemId, request);
    }
}
