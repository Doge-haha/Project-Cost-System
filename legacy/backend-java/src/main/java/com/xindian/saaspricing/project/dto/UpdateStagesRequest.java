package com.xindian.saaspricing.project.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record UpdateStagesRequest(
        @NotEmpty List<@Valid StageItem> stages
) {
    public record StageItem(
            @NotNull String stageCode,
            @NotNull Integer sequenceNo,
            UUID assigneeUserId,
            UUID reviewerUserId,
            Boolean aiEnabled,
            String autoFlowMode,
            @NotNull Boolean isEnabled
    ) {
    }
}

