package com.xindian.saaspricing.project.repository;

import com.xindian.saaspricing.project.dto.ProjectMemberResponse;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectMemberRepository {

    List<ProjectMemberResponse> findByProjectId(UUID projectId);

    Optional<ProjectMemberResponse> findActiveMember(UUID projectId, UUID userId);

    void replaceProjectMembers(UUID projectId, List<ProjectMemberResponse> members);
}

