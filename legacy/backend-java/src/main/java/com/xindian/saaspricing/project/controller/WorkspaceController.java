package com.xindian.saaspricing.project.controller;

import com.xindian.saaspricing.project.dto.WorkspaceResponse;
import com.xindian.saaspricing.project.service.ProjectApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{id}/workspace")
public class WorkspaceController {

    private final ProjectApplicationService projectApplicationService;

    public WorkspaceController(ProjectApplicationService projectApplicationService) {
        this.projectApplicationService = projectApplicationService;
    }

    @GetMapping
    public WorkspaceResponse getWorkspace(
            @org.springframework.web.bind.annotation.PathVariable UUID id,
            @RequestParam(required = false) String stageCode
    ) {
        return projectApplicationService.getWorkspace(id, stageCode);
    }
}
