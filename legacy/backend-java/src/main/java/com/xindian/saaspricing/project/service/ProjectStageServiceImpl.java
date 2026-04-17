package com.xindian.saaspricing.project.service;

import com.xindian.saaspricing.auth.ProjectPermissionGuard;
import com.xindian.saaspricing.common.exception.NotFoundException;
import com.xindian.saaspricing.common.exception.ValidationException;
import com.xindian.saaspricing.project.dto.StageResponse;
import com.xindian.saaspricing.project.dto.UpdateStagesRequest;
import com.xindian.saaspricing.project.repository.ProjectRepository;
import com.xindian.saaspricing.project.repository.ProjectStageRepository;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectStageServiceImpl implements ProjectStageService {

    private final ProjectRepository projectRepository;
    private final ProjectStageRepository projectStageRepository;
    private final ProjectPermissionGuard permissionGuard;

    public ProjectStageServiceImpl(
            ProjectRepository projectRepository,
            ProjectStageRepository projectStageRepository,
            ProjectPermissionGuard permissionGuard
    ) {
        this.projectRepository = projectRepository;
        this.projectStageRepository = projectStageRepository;
        this.permissionGuard = permissionGuard;
    }

    @Override
    public List<StageResponse> getStages(UUID projectId) {
        permissionGuard.assertCanViewProject(projectId);
        ensureProjectExists(projectId);
        return projectStageRepository.findByProjectId(projectId);
    }

    @Override
    public List<StageResponse> updateStages(UUID projectId, UpdateStagesRequest request) {
        permissionGuard.assertCanEditProject(projectId);
        ensureProjectExists(projectId);

        long distinctCodes = request.stages().stream().map(UpdateStagesRequest.StageItem::stageCode).distinct().count();
        long distinctSequences = request.stages().stream().map(UpdateStagesRequest.StageItem::sequenceNo).distinct().count();
        if (distinctCodes != request.stages().size()) {
            throw new ValidationException("阶段编码不可重复", Map.of("stages", request.stages()));
        }
        if (distinctSequences != request.stages().size()) {
            throw new ValidationException("阶段顺序不可重复", Map.of("stages", request.stages()));
        }

        Map<String, StageResponse> existing = getStages(projectId).stream()
                .collect(Collectors.toMap(StageResponse::stageCode, stage -> stage));

        List<StageResponse> updated = request.stages().stream()
                .map(item -> {
                    StageResponse current = existing.get(item.stageCode());
                    if (current == null) {
                        throw new ValidationException("存在未知阶段编码", Map.of("stageCode", item.stageCode()));
                    }
                    return new StageResponse(
                            current.id(),
                            current.projectId(),
                            current.stageCode(),
                            current.stageName(),
                            item.sequenceNo(),
                            current.status(),
                            item.assigneeUserId(),
                            item.reviewerUserId(),
                            item.aiEnabled() != null ? item.aiEnabled() : current.aiEnabled(),
                            item.autoFlowMode() != null ? item.autoFlowMode() : current.autoFlowMode(),
                            item.isEnabled()
                    );
                })
                .sorted(Comparator.comparing(StageResponse::sequenceNo))
                .toList();

        projectStageRepository.replaceProjectStages(projectId, updated);
        return updated;
    }

    private void ensureProjectExists(UUID projectId) {
        if (projectRepository.findById(projectId).isEmpty()) {
            throw new NotFoundException("项目不存在");
        }
    }
}
