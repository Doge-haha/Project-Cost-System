package com.xindian.saaspricing.discipline.service;

import com.xindian.saaspricing.auth.ProjectPermissionGuard;
import com.xindian.saaspricing.common.exception.NotFoundException;
import com.xindian.saaspricing.common.exception.ValidationException;
import com.xindian.saaspricing.discipline.dto.ProjectDisciplineResponse;
import com.xindian.saaspricing.discipline.dto.StandardSetResponse;
import com.xindian.saaspricing.discipline.dto.UpdateProjectDisciplinesRequest;
import com.xindian.saaspricing.discipline.repository.StandardSetRepository;
import com.xindian.saaspricing.project.repository.ProjectDisciplineRepository;
import com.xindian.saaspricing.project.repository.ProjectRepository;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectDisciplineServiceImpl implements ProjectDisciplineService {

    private final ProjectRepository projectRepository;
    private final ProjectDisciplineRepository projectDisciplineRepository;
    private final StandardSetRepository standardSetRepository;
    private final ProjectPermissionGuard permissionGuard;

    public ProjectDisciplineServiceImpl(
            ProjectRepository projectRepository,
            ProjectDisciplineRepository projectDisciplineRepository,
            StandardSetRepository standardSetRepository,
            ProjectPermissionGuard permissionGuard
    ) {
        this.projectRepository = projectRepository;
        this.projectDisciplineRepository = projectDisciplineRepository;
        this.standardSetRepository = standardSetRepository;
        this.permissionGuard = permissionGuard;
    }

    @Override
    public List<ProjectDisciplineResponse> getProjectDisciplines(UUID projectId) {
        permissionGuard.assertCanViewProject(projectId);
        ensureProjectExists(projectId);
        return projectDisciplineRepository.findByProjectId(projectId);
    }

    @Override
    public List<ProjectDisciplineResponse> updateProjectDisciplines(UUID projectId, UpdateProjectDisciplinesRequest request) {
        permissionGuard.assertCanEditProject(projectId);
        ensureProjectExists(projectId);
        Set<String> validStandardSetCodes = standardSetRepository.findAll(null, null, "active").stream()
                .map(StandardSetResponse::standardSetCode)
                .collect(java.util.stream.Collectors.toSet());

        List<ProjectDisciplineResponse> updated = request.items().stream()
                .map(item -> {
                    if (item.standardSetCode() != null && !validStandardSetCodes.contains(item.standardSetCode())) {
                        throw new ValidationException("专业与定额集绑定不合法", java.util.Map.of(
                                "disciplineCode", item.disciplineCode(),
                                "standardSetCode", item.standardSetCode()
                        ));
                    }
                    OffsetDateTime now = OffsetDateTime.now();
                    return new ProjectDisciplineResponse(
                            UUID.randomUUID(),
                            projectId,
                            item.disciplineCode(),
                            item.standardSetCode(),
                            item.sortOrder(),
                            item.isEnabled(),
                            now,
                            now
                    );
                })
                .sorted(java.util.Comparator.comparing(ProjectDisciplineResponse::sortOrder))
                .toList();

        projectDisciplineRepository.replaceProjectDisciplines(projectId, updated);
        return updated;
    }

    @Override
    public List<StandardSetResponse> listStandardSets(String disciplineCode, String regionCode, String status) {
        permissionGuard.assertCanViewStandardSets();
        return standardSetRepository.findAll(disciplineCode, regionCode, status);
    }

    private void ensureProjectExists(UUID projectId) {
        if (projectRepository.findById(projectId).isEmpty()) {
            throw new NotFoundException("项目不存在");
        }
    }
}
