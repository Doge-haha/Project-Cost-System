package com.xindian.saaspricing.project.dto;

import com.xindian.saaspricing.discipline.dto.ProjectDisciplineResponse;

import java.util.List;
import java.util.Map;

public record WorkspaceResponse(
        ProjectResponse project,
        StageResponse currentStage,
        List<StageResponse> enabledStages,
        List<ProjectDisciplineResponse> disciplines,
        List<Map<String, Object>> memberScopes,
        Map<String, Object> todoSummary,
        Map<String, Object> riskSummary
) {
}

