package com.xindian.saaspricing.project.service;

import com.xindian.saaspricing.auth.ProjectPermissionGuard;
import com.xindian.saaspricing.common.exception.NotFoundException;
import com.xindian.saaspricing.common.exception.ValidationException;
import com.xindian.saaspricing.discipline.dto.ProjectDisciplineResponse;
import com.xindian.saaspricing.project.dto.ProjectMemberResponse;
import com.xindian.saaspricing.project.dto.StageResponse;
import com.xindian.saaspricing.project.dto.UpdateProjectMembersRequest;
import com.xindian.saaspricing.project.repository.ProjectMemberRepository;
import com.xindian.saaspricing.project.repository.ProjectDisciplineRepository;
import com.xindian.saaspricing.project.repository.ProjectRepository;
import com.xindian.saaspricing.project.repository.ProjectStageRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectMemberServiceImpl implements ProjectMemberService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectStageRepository projectStageRepository;
    private final ProjectDisciplineRepository projectDisciplineRepository;
    private final ProjectPermissionGuard permissionGuard;

    public ProjectMemberServiceImpl(
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            ProjectStageRepository projectStageRepository,
            ProjectDisciplineRepository projectDisciplineRepository,
            ProjectPermissionGuard permissionGuard
    ) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.projectStageRepository = projectStageRepository;
        this.projectDisciplineRepository = projectDisciplineRepository;
        this.permissionGuard = permissionGuard;
    }

    @Override
    public List<ProjectMemberResponse> getMembers(UUID projectId) {
        permissionGuard.assertCanViewProject(projectId);
        ensureProjectExists(projectId);
        return projectMemberRepository.findByProjectId(projectId);
    }

    @Override
    public List<ProjectMemberResponse> updateMembers(UUID projectId, UpdateProjectMembersRequest request) {
        permissionGuard.assertCanEditProject(projectId);
        ensureProjectExists(projectId);
        validateMemberScopes(projectId, request);
        List<ProjectMemberResponse> updated = request.items().stream()
                .map(item -> new ProjectMemberResponse(
                        item.memberId() != null ? item.memberId() : UUID.randomUUID(),
                        projectId,
                        item.userId(),
                        item.platformRole(),
                        item.businessIdentities(),
                        item.memberStatus(),
                        item.scopes() == null ? List.of() : item.scopes().stream()
                                .map(scope -> new ProjectMemberResponse.RoleScopeResponse(scope.scopeType(), scope.scopeCode()))
                                .toList(),
                        java.time.OffsetDateTime.now(),
                        java.time.OffsetDateTime.now()
                ))
                .toList();
        projectMemberRepository.replaceProjectMembers(projectId, updated);
        return updated;
    }

    private void validateMemberScopes(UUID projectId, UpdateProjectMembersRequest request) {
        Set<String> validStageCodes = projectStageRepository.findByProjectId(projectId).stream()
                .map(StageResponse::stageCode)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> validDisciplineCodes = projectDisciplineRepository.findByProjectId(projectId).stream()
                .filter(ProjectDisciplineResponse::isEnabled)
                .map(ProjectDisciplineResponse::disciplineCode)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> allowedScopeTypes = Set.of("stage", "discipline", "unit");

        for (UpdateProjectMembersRequest.Item item : request.items()) {
            if (item.scopes() == null) {
                continue;
            }
            for (UpdateProjectMembersRequest.ScopeItem scope : item.scopes()) {
                if (!allowedScopeTypes.contains(scope.scopeType())) {
                    throw new ValidationException("存在未知权限范围类型", Map.of(
                            "userId", item.userId(),
                            "scopeType", scope.scopeType(),
                            "scopeCode", scope.scopeCode()
                    ));
                }
                if ("stage".equals(scope.scopeType()) && !validStageCodes.contains(scope.scopeCode())) {
                    throw new ValidationException("阶段权限范围不存在", Map.of(
                            "userId", item.userId(),
                            "scopeType", scope.scopeType(),
                            "scopeCode", scope.scopeCode()
                    ));
                }
                if ("discipline".equals(scope.scopeType()) && !validDisciplineCodes.contains(scope.scopeCode())) {
                    throw new ValidationException("专业权限范围不存在或未启用", Map.of(
                            "userId", item.userId(),
                            "scopeType", scope.scopeType(),
                            "scopeCode", scope.scopeCode()
                    ));
                }
            }
        }
    }

    private void ensureProjectExists(UUID projectId) {
        if (projectRepository.findById(projectId).isEmpty()) {
            throw new NotFoundException("项目不存在");
        }
    }
}
