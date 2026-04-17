package com.xindian.saaspricing.bill.controller;

import com.xindian.saaspricing.bill.dto.BillVersionResponse;
import com.xindian.saaspricing.bill.dto.BillVersionValidationSummary;
import com.xindian.saaspricing.bill.dto.CreateBillVersionRequest;
import com.xindian.saaspricing.bill.service.BillVersionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{id}/bill-versions")
public class BillVersionController {

    private final BillVersionService billVersionService;

    public BillVersionController(BillVersionService billVersionService) {
        this.billVersionService = billVersionService;
    }

    @GetMapping
    public Map<String, List<BillVersionResponse>> listBillVersions(
            @PathVariable UUID id,
            @RequestParam(required = false) String stageCode,
            @RequestParam(required = false) String disciplineCode
    ) {
        return Map.of("items", billVersionService.listBillVersions(id, stageCode, disciplineCode));
    }

    @PostMapping
    public ResponseEntity<BillVersionResponse> createBillVersion(
            @PathVariable UUID id,
            @Valid @RequestBody CreateBillVersionRequest request
    ) {
        BillVersionResponse response = billVersionService.createBillVersion(id, request);
        return ResponseEntity.created(URI.create("/api/v1/projects/" + id + "/bill-versions/" + response.id())).body(response);
    }

    @PostMapping("/{versionId}/copy-from")
    public ResponseEntity<BillVersionResponse> copyFromVersion(
            @PathVariable UUID id,
            @PathVariable UUID versionId
    ) {
        BillVersionResponse response = billVersionService.copyFromVersion(id, versionId);
        return ResponseEntity.created(URI.create("/api/v1/projects/" + id + "/bill-versions/" + response.id())).body(response);
    }

    @GetMapping("/{versionId}/source-chain")
    public Map<String, List<BillVersionResponse>> getSourceChain(
            @PathVariable UUID id,
            @PathVariable UUID versionId
    ) {
        return Map.of("items", billVersionService.getSourceChain(id, versionId));
    }

    @GetMapping("/{versionId}/validation-summary")
    public BillVersionValidationSummary getValidationSummary(
            @PathVariable UUID id,
            @PathVariable UUID versionId
    ) {
        return billVersionService.getValidationSummary(id, versionId);
    }

    @PostMapping("/{versionId}/lock")
    public BillVersionResponse lockVersion(
            @PathVariable UUID id,
            @PathVariable UUID versionId
    ) {
        return billVersionService.lockVersion(id, versionId);
    }

    @PostMapping("/{versionId}/submit")
    public BillVersionResponse submitVersion(
            @PathVariable UUID id,
            @PathVariable UUID versionId
    ) {
        return billVersionService.submitVersion(id, versionId);
    }

    @PostMapping("/{versionId}/withdraw")
    public BillVersionResponse withdrawVersion(
            @PathVariable UUID id,
            @PathVariable UUID versionId
    ) {
        return billVersionService.withdrawVersion(id, versionId);
    }
}
