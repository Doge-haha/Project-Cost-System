package com.xindian.saaspricing.bill.service;

import com.xindian.saaspricing.bill.dto.BillVersionResponse;
import com.xindian.saaspricing.bill.dto.BillVersionValidationSummary;
import com.xindian.saaspricing.bill.dto.CreateBillVersionRequest;

import java.util.List;
import java.util.UUID;

public interface BillVersionService {

    List<BillVersionResponse> listBillVersions(UUID projectId, String stageCode, String disciplineCode);

    BillVersionResponse createBillVersion(UUID projectId, CreateBillVersionRequest request);

    BillVersionResponse copyFromVersion(UUID projectId, UUID sourceVersionId);

    List<BillVersionResponse> getSourceChain(UUID projectId, UUID versionId);

    BillVersionResponse lockVersion(UUID projectId, UUID versionId);

    BillVersionResponse submitVersion(UUID projectId, UUID versionId);

    BillVersionResponse withdrawVersion(UUID projectId, UUID versionId);

    BillVersionValidationSummary getValidationSummary(UUID projectId, UUID versionId);
}
