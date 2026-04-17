package com.xindian.saaspricing.project.service;

import com.xindian.saaspricing.project.dto.ProjectMemberResponse;
import com.xindian.saaspricing.project.dto.UpdateProjectMembersRequest;

import java.util.List;
import java.util.UUID;

public interface ProjectMemberService {

    List<ProjectMemberResponse> getMembers(UUID projectId);

    List<ProjectMemberResponse> updateMembers(UUID projectId, UpdateProjectMembersRequest request);
}

