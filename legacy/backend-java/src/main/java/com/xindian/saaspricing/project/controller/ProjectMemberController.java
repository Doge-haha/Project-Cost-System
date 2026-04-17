package com.xindian.saaspricing.project.controller;

import com.xindian.saaspricing.project.dto.ProjectMemberResponse;
import com.xindian.saaspricing.project.dto.UpdateProjectMembersRequest;
import com.xindian.saaspricing.project.service.ProjectMemberService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{id}/members")
public class ProjectMemberController {

    private final ProjectMemberService projectMemberService;

    public ProjectMemberController(ProjectMemberService projectMemberService) {
        this.projectMemberService = projectMemberService;
    }

    @GetMapping
    public Map<String, List<ProjectMemberResponse>> getMembers(@PathVariable UUID id) {
        return Map.of("items", projectMemberService.getMembers(id));
    }

    @PutMapping
    public Map<String, List<ProjectMemberResponse>> updateMembers(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateProjectMembersRequest request
    ) {
        return Map.of("items", projectMemberService.updateMembers(id, request));
    }
}

