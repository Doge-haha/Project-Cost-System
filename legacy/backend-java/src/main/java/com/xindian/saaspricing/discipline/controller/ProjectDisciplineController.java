package com.xindian.saaspricing.discipline.controller;

import com.xindian.saaspricing.discipline.dto.ProjectDisciplineResponse;
import com.xindian.saaspricing.discipline.dto.UpdateProjectDisciplinesRequest;
import com.xindian.saaspricing.discipline.service.ProjectDisciplineService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{id}/disciplines")
public class ProjectDisciplineController {

    private final ProjectDisciplineService projectDisciplineService;

    public ProjectDisciplineController(ProjectDisciplineService projectDisciplineService) {
        this.projectDisciplineService = projectDisciplineService;
    }

    @GetMapping
    public Map<String, List<ProjectDisciplineResponse>> getDisciplines(@PathVariable UUID id) {
        return Map.of("items", projectDisciplineService.getProjectDisciplines(id));
    }

    @PutMapping
    public Map<String, List<ProjectDisciplineResponse>> updateDisciplines(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateProjectDisciplinesRequest request
    ) {
        return Map.of("items", projectDisciplineService.updateProjectDisciplines(id, request));
    }
}

