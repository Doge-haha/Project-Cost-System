package com.xindian.saaspricing.auth;

import com.xindian.saaspricing.bootstrap.SaasPricingApplication;
import com.xindian.saaspricing.discipline.dto.UpdateProjectDisciplinesRequest;
import com.xindian.saaspricing.discipline.service.ProjectDisciplineService;
import com.xindian.saaspricing.project.dto.CreateProjectRequest;
import com.xindian.saaspricing.project.dto.ProjectResponse;
import com.xindian.saaspricing.project.dto.UpdateProjectMembersRequest;
import com.xindian.saaspricing.project.service.ProjectApplicationService;
import com.xindian.saaspricing.project.service.ProjectMemberService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

@ActiveProfiles("test")
@SpringBootTest(classes = SaasPricingApplication.class)
class ProjectMemberPermissionGuardTests {

    @Autowired
    private ProjectPermissionGuard projectPermissionGuard;

    @Autowired
    private ProjectApplicationService projectApplicationService;

    @Autowired
    private ProjectMemberService projectMemberService;

    @Autowired
    private ProjectDisciplineService projectDisciplineService;

    @AfterEach
    void clearRequestContext() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void scopedMemberCanOnlyViewOwnedStage() {
        UUID ownerUserId = UUID.randomUUID();
        UUID scopedUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());

        replaceMembers(project.id(), ownerUserId, scopedUserId);
        bindCurrentUser(scopedUserId);

        assertDoesNotThrow(() -> projectPermissionGuard.assertCanViewProjectStage(project.id(), "stage_01"));
        assertThrows(
                AccessDeniedException.class,
                () -> projectPermissionGuard.assertCanViewProjectStage(project.id(), "stage_02")
        );
    }

    @Test
    void scopedMemberCanOnlyViewOwnedDiscipline() {
        UUID ownerUserId = UUID.randomUUID();
        UUID scopedUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());

        replaceMembers(project.id(), ownerUserId, scopedUserId);
        bindCurrentUser(scopedUserId);

        assertDoesNotThrow(() -> projectPermissionGuard.assertCanViewProjectDiscipline(project.id(), "building"));
        assertThrows(
                AccessDeniedException.class,
                () -> projectPermissionGuard.assertCanViewProjectDiscipline(project.id(), "installation")
        );
    }

    @Test
    void scopedMemberCanOnlyOperateInsideOwnedBusinessIdentity() {
        UUID ownerUserId = UUID.randomUUID();
        UUID scopedUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());

        replaceMembers(project.id(), ownerUserId, scopedUserId);
        bindCurrentUser(scopedUserId);

        assertDoesNotThrow(() -> projectPermissionGuard.assertCanUseBusinessIdentity(project.id(), "consultant"));
        assertThrows(
                AccessDeniedException.class,
                () -> projectPermissionGuard.assertCanUseBusinessIdentity(project.id(), "reviewer")
        );
    }

    @Test
    void scopedCostEngineerCanEditOwnedStageButNotOtherStage() {
        UUID ownerUserId = UUID.randomUUID();
        UUID scopedUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());

        replaceMembers(project.id(), ownerUserId, scopedUserId);
        bindCurrentUser(scopedUserId);

        assertDoesNotThrow(() -> projectPermissionGuard.assertCanEditProjectStage(project.id(), "stage_01"));
        assertThrows(
                AccessDeniedException.class,
                () -> projectPermissionGuard.assertCanEditProjectStage(project.id(), "stage_02")
        );
    }

    @Test
    void reviewerCannotEditStageEvenInsideScope() {
        UUID ownerUserId = UUID.randomUUID();
        UUID reviewerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());

        projectMemberService.updateMembers(project.id(), new UpdateProjectMembersRequest(List.of(
                new UpdateProjectMembersRequest.Item(
                        UUID.randomUUID(),
                        ownerUserId,
                        "project_owner",
                        List.of("owner"),
                        "active",
                        List.of()
                ),
                new UpdateProjectMembersRequest.Item(
                        UUID.randomUUID(),
                        reviewerUserId,
                        "reviewer",
                        List.of("audit_reviewer"),
                        "active",
                        List.of(new UpdateProjectMembersRequest.ScopeItem("stage", "stage_01"))
                )
        )));
        bindCurrentUser(reviewerUserId);

        assertThrows(
                AccessDeniedException.class,
                () -> projectPermissionGuard.assertCanEditProjectStage(project.id(), "stage_01")
        );
    }

    @Test
    void scopedCostEngineerCanEditOwnedDisciplineButNotOtherDiscipline() {
        UUID ownerUserId = UUID.randomUUID();
        UUID scopedUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());

        replaceMembers(project.id(), ownerUserId, scopedUserId);
        bindCurrentUser(scopedUserId);

        assertDoesNotThrow(() -> projectPermissionGuard.assertCanEditProjectDiscipline(project.id(), "building"));
        assertThrows(
                AccessDeniedException.class,
                () -> projectPermissionGuard.assertCanEditProjectDiscipline(project.id(), "installation")
        );
    }

    private ProjectResponse createProject(UUID ownerUserId) {
        return projectApplicationService.createProject(new CreateProjectRequest(
                "PRJ-" + UUID.randomUUID().toString().substring(0, 8),
                "权限守卫测试项目",
                "全过程咨询",
                "标准九阶段模板",
                ownerUserId,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        ));
    }

    private void replaceMembers(UUID projectId, UUID ownerUserId, UUID scopedUserId) {
        projectMemberService.updateMembers(projectId, new UpdateProjectMembersRequest(List.of(
                new UpdateProjectMembersRequest.Item(
                        UUID.randomUUID(),
                        ownerUserId,
                        "project_owner",
                        List.of("owner"),
                        "active",
                        List.of()
                ),
                new UpdateProjectMembersRequest.Item(
                        UUID.randomUUID(),
                        scopedUserId,
                        "cost_engineer",
                        List.of("consultant"),
                        "active",
                        List.of(
                                new UpdateProjectMembersRequest.ScopeItem("stage", "stage_01"),
                                new UpdateProjectMembersRequest.ScopeItem("discipline", "building")
                        )
                )
        )));
    }

    private void bindCurrentUser(UUID userId) {
        org.springframework.mock.web.MockHttpServletRequest request = new org.springframework.mock.web.MockHttpServletRequest();
        request.addHeader("X-User-Id", userId.toString());
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    private void enableBuildingDiscipline(UUID projectId) {
        projectDisciplineService.updateProjectDisciplines(projectId, new UpdateProjectDisciplinesRequest(List.of(
                new UpdateProjectDisciplinesRequest.Item("building", "012013tj", 1, true)
        )));
    }
}
