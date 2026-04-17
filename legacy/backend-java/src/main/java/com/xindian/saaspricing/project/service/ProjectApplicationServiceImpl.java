package com.xindian.saaspricing.project.service;

import com.xindian.saaspricing.auth.ProjectPermissionGuard;
import com.xindian.saaspricing.bootstrap.StageTemplateLoader;
import com.xindian.saaspricing.common.exception.NotFoundException;
import com.xindian.saaspricing.common.exception.ValidationException;
import com.xindian.saaspricing.discipline.dto.ProjectDisciplineResponse;
import com.xindian.saaspricing.project.dto.CreateProjectRequest;
import com.xindian.saaspricing.project.dto.ProjectMemberResponse;
import com.xindian.saaspricing.project.dto.ProjectResponse;
import com.xindian.saaspricing.project.dto.StageResponse;
import com.xindian.saaspricing.project.dto.WorkspaceResponse;
import com.xindian.saaspricing.project.enums.ProjectStatus;
import com.xindian.saaspricing.project.enums.StageStatus;
import com.xindian.saaspricing.project.repository.ProjectDisciplineRepository;
import com.xindian.saaspricing.project.repository.ProjectMemberRepository;
import com.xindian.saaspricing.project.repository.ProjectRepository;
import com.xindian.saaspricing.project.repository.ProjectStageRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProjectApplicationServiceImpl implements ProjectApplicationService {

    private final ProjectRepository projectRepository;
    private final ProjectStageRepository projectStageRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectDisciplineRepository projectDisciplineRepository;
    private final StageTemplateLoader stageTemplateLoader;
    private final ProjectPermissionGuard permissionGuard;

    public ProjectApplicationServiceImpl(
            ProjectRepository projectRepository,
            ProjectStageRepository projectStageRepository,
            ProjectMemberRepository projectMemberRepository,
            ProjectDisciplineRepository projectDisciplineRepository,
            StageTemplateLoader stageTemplateLoader,
            ProjectPermissionGuard permissionGuard
    ) {
        this.projectRepository = projectRepository;
        this.projectStageRepository = projectStageRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.projectDisciplineRepository = projectDisciplineRepository;
        this.stageTemplateLoader = stageTemplateLoader;
        this.permissionGuard = permissionGuard;
    }

    @Override
    public ProjectResponse createProject(CreateProjectRequest request) {
        if (projectRepository.existsByProjectCode(request.projectCode())) {
            throw new ValidationException("项目编号已存在", Map.of("projectCode", request.projectCode()));
        }

        UUID projectId = UUID.randomUUID();
        ProjectResponse project = new ProjectResponse(
                projectId,
                request.projectCode(),
                request.projectName(),
                request.projectType(),
                request.templateName(),
                ProjectStatus.draft,
                request.ownerUserId(),
                request.defaultPriceVersionId(),
                request.defaultFeeTemplateId(),
                request.clientName(),
                request.locationCode(),
                request.locationText(),
                request.buildingArea(),
                request.structureType(),
                request.description(),
                java.time.OffsetDateTime.now(),
                java.time.OffsetDateTime.now()
        );
        projectRepository.save(project);

        List<StageResponse> stages = stageTemplateLoader.loadDefaultStages().stream()
                .map(item -> new StageResponse(
                        UUID.randomUUID(),
                        projectId,
                        item.code(),
                        item.name(),
                        item.order(),
                        StageStatus.not_started,
                        null,
                        null,
                        Boolean.FALSE,
                        "manual_confirm",
                        Boolean.TRUE
                ))
                .toList();
        projectStageRepository.replaceProjectStages(projectId, stages);
        projectDisciplineRepository.replaceProjectDisciplines(projectId, List.of());
        projectMemberRepository.replaceProjectMembers(projectId, List.of(
                new ProjectMemberResponse(
                        UUID.randomUUID(),
                        projectId,
                        request.ownerUserId(),
                        "project_owner",
                        List.of(),
                        "active",
                        List.of(),
                        java.time.OffsetDateTime.now(),
                        java.time.OffsetDateTime.now()
                )
        ));
        return project;
    }

    @Override
    public ProjectResponse getProject(UUID projectId) {
        permissionGuard.assertCanViewProject(projectId);
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("项目不存在"));
    }

    @Override
    public WorkspaceResponse getWorkspace(UUID projectId, String stageCode) {
        if (stageCode != null && !stageCode.isBlank()) {
            permissionGuard.assertCanViewProjectStage(projectId, stageCode);
        } else {
            permissionGuard.assertCanViewProject(projectId);
        }
        ProjectResponse project = getProject(projectId);
        List<StageResponse> stages = projectStageRepository.findByProjectId(projectId);
        StageResponse currentStage = resolveCurrentStage(stages, stageCode);
        List<ProjectDisciplineResponse> disciplines = projectDisciplineRepository.findByProjectId(projectId);
        List<ProjectMemberResponse> members = projectMemberRepository.findByProjectId(projectId);
        return new WorkspaceResponse(
                project,
                currentStage,
                stages.stream().filter(StageResponse::isEnabled).toList(),
                disciplines,
                members.stream()
                        .map(member -> Map.<String, Object>of(
                                "userId", member.userId(),
                                "platformRole", member.platformRole(),
                                "businessIdentities", member.businessIdentities(),
                                "scopeCount", member.scopes().size()
                        ))
                        .toList(),
                Map.of("pendingCount", 0),
                Map.of("warningCount", 0)
        );
    }

    private StageResponse resolveCurrentStage(List<StageResponse> stages, String stageCode) {
        if (stages.isEmpty()) {
            return null;
        }
        if (stageCode == null || stageCode.isBlank()) {
            return stages.stream()
                    .filter(StageResponse::isEnabled)
                    .findFirst()
                    .orElse(stages.get(0));
        }
        return stages.stream()
                .filter(stage -> stage.stageCode().equals(stageCode))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("阶段不存在"));
    }
}
