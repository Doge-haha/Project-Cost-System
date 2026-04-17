package com.xindian.saaspricing.project.dto;

import com.xindian.saaspricing.project.enums.StageStatus;

import java.util.UUID;

public record StageResponse(
        UUID id,
        UUID projectId,
        String stageCode,
        String stageName,
        Integer sequenceNo,
        StageStatus status,
        UUID assigneeUserId,
        UUID reviewerUserId,
        Boolean aiEnabled,
        String autoFlowMode,
        Boolean isEnabled
) {
}

