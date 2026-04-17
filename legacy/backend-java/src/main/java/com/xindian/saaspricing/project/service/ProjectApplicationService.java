package com.xindian.saaspricing.project.service;

import com.xindian.saaspricing.project.dto.CreateProjectRequest;
import com.xindian.saaspricing.project.dto.ProjectResponse;
import com.xindian.saaspricing.project.dto.WorkspaceResponse;

import java.util.UUID;

public interface ProjectApplicationService {

    ProjectResponse createProject(CreateProjectRequest request);

    ProjectResponse getProject(UUID projectId);

    WorkspaceResponse getWorkspace(UUID projectId, String stageCode);
}

