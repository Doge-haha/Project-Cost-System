package com.xindian.saaspricing.project.controller;

import com.xindian.saaspricing.project.dto.CreateProjectRequest;
import com.xindian.saaspricing.project.dto.ProjectResponse;
import com.xindian.saaspricing.project.service.ProjectApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectController {

    private final ProjectApplicationService projectApplicationService;

    public ProjectController(ProjectApplicationService projectApplicationService) {
        this.projectApplicationService = projectApplicationService;
    }

    @PostMapping
    public ResponseEntity<ProjectResponse> createProject(@Valid @RequestBody CreateProjectRequest request) {
        ProjectResponse response = projectApplicationService.createProject(request);
        return ResponseEntity.created(URI.create("/api/v1/projects/" + response.id())).body(response);
    }

    @GetMapping("/{id}")
    public ProjectResponse getProject(@PathVariable UUID id) {
        return projectApplicationService.getProject(id);
    }
}

