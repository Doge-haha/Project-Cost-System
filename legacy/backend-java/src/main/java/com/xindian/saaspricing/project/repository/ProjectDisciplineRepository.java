package com.xindian.saaspricing.project.repository;

import com.xindian.saaspricing.discipline.dto.ProjectDisciplineResponse;

import java.util.List;
import java.util.UUID;

public interface ProjectDisciplineRepository {

    List<ProjectDisciplineResponse> findByProjectId(UUID projectId);

    void replaceProjectDisciplines(UUID projectId, List<ProjectDisciplineResponse> items);
}

