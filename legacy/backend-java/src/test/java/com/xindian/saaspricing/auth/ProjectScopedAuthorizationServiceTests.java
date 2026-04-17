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
class ProjectScopedAuthorizationServiceTests {

    @Autowired
    private ProjectScopedAuthorizationService authorizationService;

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
    void scopedCostEngineerCanViewAndEditOwnedStageDisciplineIdentityContext() {
        UUID ownerUserId = UUID.randomUUID();
        UUID scopedUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, scopedUserId, "cost_engineer", "consultant");
        bindCurrentUser(scopedUserId);

        assertDoesNotThrow(() -> authorizationService.assertCanViewContext(
                project.id(),
                "stage_01",
                "building",
                "consultant"
        ));
        assertDoesNotThrow(() -> authorizationService.assertCanEditContext(
                project.id(),
                "stage_01",
                "building",
                "consultant"
        ));
    }

    @Test
    void scopedCostEngineerCannotEditContextOutsideOwnedStageDisciplineOrIdentity() {
        UUID ownerUserId = UUID.randomUUID();
        UUID scopedUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, scopedUserId, "cost_engineer", "consultant");
        bindCurrentUser(scopedUserId);

        assertThrows(AccessDeniedException.class, () -> authorizationService.assertCanEditContext(
                project.id(),
                "stage_02",
                "building",
                "consultant"
        ));
        assertThrows(AccessDeniedException.class, () -> authorizationService.assertCanEditContext(
                project.id(),
                "stage_01",
                "installation",
                "consultant"
        ));
        assertThrows(AccessDeniedException.class, () -> authorizationService.assertCanEditContext(
                project.id(),
                "stage_01",
                "building",
                "reviewer"
        ));
    }

    @Test
    void reviewerCanViewButCannotEditSameContext() {
        UUID ownerUserId = UUID.randomUUID();
        UUID reviewerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, reviewerUserId, "reviewer", "audit_reviewer");
        bindCurrentUser(reviewerUserId);

        assertDoesNotThrow(() -> authorizationService.assertCanViewContext(
                project.id(),
                "stage_01",
                "building",
                "audit_reviewer"
        ));
        assertThrows(AccessDeniedException.class, () -> authorizationService.assertCanEditContext(
                project.id(),
                "stage_01",
                "building",
                "audit_reviewer"
        ));
    }

    private ProjectResponse createProject(UUID ownerUserId) {
        return projectApplicationService.createProject(new CreateProjectRequest(
                "PRJ-" + UUID.randomUUID().toString().substring(0, 8),
                "组合授权测试项目",
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

    private void replaceMembers(
            UUID projectId,
            UUID ownerUserId,
            UUID userId,
            String platformRole,
            String businessIdentity
    ) {
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
                        userId,
                        platformRole,
                        List.of(businessIdentity),
                        "active",
                        List.of(
                                new UpdateProjectMembersRequest.ScopeItem("stage", "stage_01"),
                                new UpdateProjectMembersRequest.ScopeItem("discipline", "building")
                        )
                )
        )));
    }

    private void enableBuildingDiscipline(UUID projectId) {
        projectDisciplineService.updateProjectDisciplines(projectId, new UpdateProjectDisciplinesRequest(List.of(
                new UpdateProjectDisciplinesRequest.Item("building", "012013tj", 1, true)
        )));
    }

    private void bindCurrentUser(UUID userId) {
        org.springframework.mock.web.MockHttpServletRequest request = new org.springframework.mock.web.MockHttpServletRequest();
        request.addHeader("X-User-Id", userId.toString());
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
}
