package com.xindian.saaspricing.project.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xindian.saaspricing.bootstrap.SaasPricingApplication;
import com.xindian.saaspricing.discipline.dto.UpdateProjectDisciplinesRequest;
import com.xindian.saaspricing.project.dto.CreateProjectRequest;
import com.xindian.saaspricing.project.dto.ProjectResponse;
import com.xindian.saaspricing.project.dto.UpdateProjectMembersRequest;
import com.xindian.saaspricing.project.dto.UpdateStagesRequest;
import com.xindian.saaspricing.discipline.service.ProjectDisciplineService;
import com.xindian.saaspricing.project.service.ProjectApplicationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest(classes = SaasPricingApplication.class)
class ProjectPermissionIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProjectApplicationService projectApplicationService;

    @Autowired
    private ProjectDisciplineService projectDisciplineService;

    @Test
    void ownerCanViewProjectAndWorkspace() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);

        mockMvc.perform(get("/api/v1/projects/{id}", project.id())
                        .header("X-User-Id", ownerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(project.id().toString()))
                .andExpect(jsonPath("$.projectCode").value(project.projectCode()));

        mockMvc.perform(get("/api/v1/projects/{id}/workspace", project.id())
                        .header("X-User-Id", ownerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.project.id").value(project.id().toString()))
                .andExpect(jsonPath("$.currentStage.stageCode").value("stage_01"));
    }

    @Test
    void nonMemberCannotViewProject() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);

        mockMvc.perform(get("/api/v1/projects/{id}", project.id())
                        .header("X-User-Id", UUID.randomUUID()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void activeViewerMemberCanViewButCannotEditStages() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID viewerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());

        UpdateProjectMembersRequest memberRequest = new UpdateProjectMembersRequest(List.of(
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
                        viewerUserId,
                        "cost_engineer",
                        List.of("consultant"),
                        "active",
                        List.of(
                                new UpdateProjectMembersRequest.ScopeItem("stage", "stage_01"),
                                new UpdateProjectMembersRequest.ScopeItem("discipline", "building")
                        )
                )
        ));

        mockMvc.perform(put("/api/v1/projects/{id}/members", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(memberRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2));

        mockMvc.perform(get("/api/v1/projects/{id}/stages", project.id())
                        .header("X-User-Id", viewerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(9));

        UpdateStagesRequest updateStagesRequest = new UpdateStagesRequest(List.of(
                new UpdateStagesRequest.StageItem("stage_01", 1, viewerUserId, null, false, "manual_confirm", true),
                new UpdateStagesRequest.StageItem("stage_02", 2, null, null, false, "manual_confirm", true),
                new UpdateStagesRequest.StageItem("stage_03", 3, null, null, false, "manual_confirm", true),
                new UpdateStagesRequest.StageItem("stage_04", 4, null, null, false, "manual_confirm", true),
                new UpdateStagesRequest.StageItem("stage_05", 5, null, null, false, "manual_confirm", true),
                new UpdateStagesRequest.StageItem("stage_06", 6, null, null, false, "manual_confirm", true),
                new UpdateStagesRequest.StageItem("stage_07", 7, null, null, false, "manual_confirm", true),
                new UpdateStagesRequest.StageItem("stage_08", 8, null, null, false, "manual_confirm", true),
                new UpdateStagesRequest.StageItem("stage_09", 9, null, null, false, "manual_confirm", true)
        ));

        mockMvc.perform(put("/api/v1/projects/{id}/stages", project.id())
                        .header("X-User-Id", viewerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateStagesRequest)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void scopedViewerCannotOpenWorkspaceForStageOutsideOwnedScope() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID viewerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);

        UpdateProjectMembersRequest memberRequest = new UpdateProjectMembersRequest(List.of(
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
                        viewerUserId,
                        "cost_engineer",
                        List.of("consultant"),
                        "active",
                        List.of(new UpdateProjectMembersRequest.ScopeItem("stage", "stage_01"))
                )
        ));

        mockMvc.perform(put("/api/v1/projects/{id}/members", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(memberRequest)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/projects/{id}/workspace", project.id())
                        .header("X-User-Id", viewerUserId)
                        .param("stageCode", "stage_01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStage.stageCode").value("stage_01"));

        mockMvc.perform(get("/api/v1/projects/{id}/workspace", project.id())
                        .header("X-User-Id", viewerUserId)
                        .param("stageCode", "stage_02"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void ownerCanUpdateDisciplinesButNonMemberCannotReadThem() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);

        UpdateProjectDisciplinesRequest request = new UpdateProjectDisciplinesRequest(List.of(
                new UpdateProjectDisciplinesRequest.Item("building", "012013tj", 1, true)
        ));

        mockMvc.perform(put("/api/v1/projects/{id}/disciplines", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].disciplineCode").value("building"));

        mockMvc.perform(get("/api/v1/projects/{id}/disciplines", project.id())
                        .header("X-User-Id", UUID.randomUUID()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void ownerCannotAssignUnknownStageScopeToMember() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);

        UpdateProjectMembersRequest memberRequest = new UpdateProjectMembersRequest(List.of(
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
                        UUID.randomUUID(),
                        "cost_engineer",
                        List.of("consultant"),
                        "active",
                        List.of(new UpdateProjectMembersRequest.ScopeItem("stage", "stage_99"))
                )
        ));

        mockMvc.perform(put("/api/v1/projects/{id}/members", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(memberRequest)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void ownerCannotAssignUnknownDisciplineScopeToMember() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);

        UpdateProjectMembersRequest memberRequest = new UpdateProjectMembersRequest(List.of(
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
                        UUID.randomUUID(),
                        "cost_engineer",
                        List.of("consultant"),
                        "active",
                        List.of(new UpdateProjectMembersRequest.ScopeItem("discipline", "installation"))
                )
        ));

        mockMvc.perform(put("/api/v1/projects/{id}/members", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(memberRequest)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void ownerCannotAssignUnknownScopeTypeToMember() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);

        UpdateProjectMembersRequest memberRequest = new UpdateProjectMembersRequest(List.of(
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
                        UUID.randomUUID(),
                        "cost_engineer",
                        List.of("consultant"),
                        "active",
                        List.of(new UpdateProjectMembersRequest.ScopeItem("weird_scope", "x"))
                )
        ));

        mockMvc.perform(put("/api/v1/projects/{id}/members", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(memberRequest)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    private ProjectResponse createProject(UUID ownerUserId) {
        return projectApplicationService.createProject(new CreateProjectRequest(
                "PRJ-" + UUID.randomUUID().toString().substring(0, 8),
                "权限测试项目",
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

    private void enableBuildingDiscipline(UUID projectId) {
        projectDisciplineService.updateProjectDisciplines(projectId, new UpdateProjectDisciplinesRequest(List.of(
                new UpdateProjectDisciplinesRequest.Item("building", "012013tj", 1, true)
        )));
    }
}
