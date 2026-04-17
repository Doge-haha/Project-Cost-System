package com.xindian.saaspricing.project.service;

import com.xindian.saaspricing.project.dto.StageResponse;
import com.xindian.saaspricing.project.dto.UpdateStagesRequest;

import java.util.List;
import java.util.UUID;

public interface ProjectStageService {

    List<StageResponse> getStages(UUID projectId);

    List<StageResponse> updateStages(UUID projectId, UpdateStagesRequest request);
}

