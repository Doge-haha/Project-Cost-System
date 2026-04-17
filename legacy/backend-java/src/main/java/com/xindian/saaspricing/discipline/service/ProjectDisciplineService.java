package com.xindian.saaspricing.discipline.service;

import com.xindian.saaspricing.discipline.dto.ProjectDisciplineResponse;
import com.xindian.saaspricing.discipline.dto.StandardSetResponse;
import com.xindian.saaspricing.discipline.dto.UpdateProjectDisciplinesRequest;

import java.util.List;
import java.util.UUID;

public interface ProjectDisciplineService {

    List<ProjectDisciplineResponse> getProjectDisciplines(UUID projectId);

    List<ProjectDisciplineResponse> updateProjectDisciplines(UUID projectId, UpdateProjectDisciplinesRequest request);

    List<StandardSetResponse> listStandardSets(String disciplineCode, String regionCode, String status);
}

