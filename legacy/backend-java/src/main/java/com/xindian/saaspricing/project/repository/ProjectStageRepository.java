package com.xindian.saaspricing.project.repository;

import com.xindian.saaspricing.project.dto.StageResponse;

import java.util.List;
import java.util.UUID;

public interface ProjectStageRepository {

    List<StageResponse> findByProjectId(UUID projectId);

    void replaceProjectStages(UUID projectId, List<StageResponse> stages);
}

