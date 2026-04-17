package com.xindian.saaspricing.project.controller;

import com.xindian.saaspricing.project.dto.StageResponse;
import com.xindian.saaspricing.project.dto.UpdateStagesRequest;
import com.xindian.saaspricing.project.service.ProjectStageService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{id}/stages")
public class ProjectStageController {

    private final ProjectStageService projectStageService;

    public ProjectStageController(ProjectStageService projectStageService) {
        this.projectStageService = projectStageService;
    }

    @GetMapping
    public Map<String, List<StageResponse>> getStages(@PathVariable UUID id) {
        return Map.of("items", projectStageService.getStages(id));
    }

    @PutMapping
    public Map<String, List<StageResponse>> updateStages(@PathVariable UUID id, @Valid @RequestBody UpdateStagesRequest request) {
        return Map.of("items", projectStageService.updateStages(id, request));
    }
}

