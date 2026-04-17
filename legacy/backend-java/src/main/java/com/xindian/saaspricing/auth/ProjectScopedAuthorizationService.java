package com.xindian.saaspricing.auth;

import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class ProjectScopedAuthorizationService {

    private final ProjectPermissionGuard projectPermissionGuard;

    public ProjectScopedAuthorizationService(ProjectPermissionGuard projectPermissionGuard) {
        this.projectPermissionGuard = projectPermissionGuard;
    }

    public void assertCanViewContext(
            UUID projectId,
            String stageCode,
            String disciplineCode,
            String businessIdentity
    ) {
        projectPermissionGuard.assertCanViewProject(projectId);
        projectPermissionGuard.assertCanViewProjectStage(projectId, stageCode);
        projectPermissionGuard.assertCanViewProjectDiscipline(projectId, disciplineCode);
        projectPermissionGuard.assertCanUseBusinessIdentity(projectId, businessIdentity);
    }

    public void assertCanEditContext(
            UUID projectId,
            String stageCode,
            String disciplineCode,
            String businessIdentity
    ) {
        projectPermissionGuard.assertCanViewProject(projectId);
        projectPermissionGuard.assertCanEditProjectStage(projectId, stageCode);
        projectPermissionGuard.assertCanEditProjectDiscipline(projectId, disciplineCode);
        projectPermissionGuard.assertCanUseBusinessIdentity(projectId, businessIdentity);
    }
}
