package com.xindian.saaspricing.project.repository;

import com.xindian.saaspricing.project.dto.ProjectResponse;

import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository {

    boolean existsByProjectCode(String projectCode);

    void save(ProjectResponse project);

    Optional<ProjectResponse> findById(UUID projectId);
}

