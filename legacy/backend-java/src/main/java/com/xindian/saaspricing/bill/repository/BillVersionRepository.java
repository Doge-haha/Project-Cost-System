package com.xindian.saaspricing.bill.repository;

import com.xindian.saaspricing.bill.dto.BillVersionContext;
import com.xindian.saaspricing.bill.dto.BillVersionResponse;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BillVersionRepository {

    Optional<BillVersionContext> findById(UUID billVersionId);

    List<BillVersionResponse> findByProjectId(UUID projectId, String stageCode, String disciplineCode);

    int nextVersionNo(UUID projectId, String stageCode);

    BillVersionResponse save(BillVersionResponse billVersion);

    BillVersionResponse updateLockStatus(UUID versionId, String lockStatus);

    BillVersionResponse updateVersionStatus(UUID versionId, String versionStatus);
}
