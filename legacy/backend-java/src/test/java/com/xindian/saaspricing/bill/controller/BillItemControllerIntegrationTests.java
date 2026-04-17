package com.xindian.saaspricing.bill.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xindian.saaspricing.bootstrap.SaasPricingApplication;
import com.xindian.saaspricing.bill.dto.CreateBillItemRequest;
import com.xindian.saaspricing.discipline.dto.UpdateProjectDisciplinesRequest;
import com.xindian.saaspricing.discipline.service.ProjectDisciplineService;
import com.xindian.saaspricing.project.dto.CreateProjectRequest;
import com.xindian.saaspricing.project.dto.ProjectResponse;
import com.xindian.saaspricing.project.dto.UpdateProjectMembersRequest;
import com.xindian.saaspricing.project.service.ProjectApplicationService;
import com.xindian.saaspricing.project.service.ProjectMemberService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest(classes = SaasPricingApplication.class)
class BillItemControllerIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ProjectApplicationService projectApplicationService;

    @Autowired
    private ProjectDisciplineService projectDisciplineService;

    @Autowired
    private ProjectMemberService projectMemberService;

    @Test
    void scopedCostEngineerCanCreateAndListBillItemsInsideAuthorizedContext() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");
        UUID billVersionId = insertBillVersion(project.id(), "stage_01", "building", "consultant");

        CreateBillItemRequest request = new CreateBillItemRequest(
                billVersionId,
                null,
                1,
                1,
                "010101001",
                "土方开挖",
                "m3",
                null,
                null,
                null,
                false,
                BigDecimal.ONE,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.itemCode").value("010101001"))
                .andExpect(jsonPath("$.itemName").value("土方开挖"));

        mockMvc.perform(get("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .param("billVersionId", billVersionId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void scopedCostEngineerCannotCreateBillItemsOutsideAuthorizedContext() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");
        UUID billVersionId = insertBillVersion(project.id(), "stage_02", "building", "consultant");

        CreateBillItemRequest request = new CreateBillItemRequest(
                billVersionId,
                null,
                1,
                1,
                "010101002",
                "混凝土垫层",
                "m3",
                null,
                null,
                null,
                false,
                BigDecimal.ONE,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void cannotCreateChildBillItemWithParentFromAnotherVersion() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");
        UUID parentVersionId = insertBillVersion(project.id(), "stage_01", "building", "consultant");
        UUID targetVersionId = insertBillVersion(project.id(), "stage_01", "building", "consultant");

        String parentJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                parentVersionId,
                                null,
                                1,
                                1,
                                "010101001",
                                "来源父节点",
                                "项",
                                null,
                                null,
                                null,
                                false,
                                BigDecimal.ONE,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        UUID parentId = UUID.fromString(objectMapper.readTree(parentJson).get("id").asText());

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                targetVersionId,
                                parentId,
                                2,
                                2,
                                "010101002",
                                "非法子节点",
                                "m3",
                                null,
                                null,
                                null,
                                false,
                                BigDecimal.ONE,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null
                        ))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void cannotCreateChildBillItemWithMissingParent() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");
        UUID targetVersionId = insertBillVersion(project.id(), "stage_01", "building", "consultant");

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                targetVersionId,
                                UUID.randomUUID(),
                                2,
                                2,
                                "010101006",
                                "缺失父节点",
                                "m3",
                                null,
                                null,
                                null,
                                false,
                                BigDecimal.ONE,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null
                        ))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    private ProjectResponse createProject(UUID ownerUserId) {
        return projectApplicationService.createProject(new CreateProjectRequest(
                "PRJ-" + UUID.randomUUID().toString().substring(0, 8),
                "清单接口测试项目",
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

    private void replaceMembers(UUID projectId, UUID ownerUserId, UUID userId, String role, String identity) {
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
                        role,
                        List.of(identity),
                        "active",
                        List.of(
                                new UpdateProjectMembersRequest.ScopeItem("stage", "stage_01"),
                                new UpdateProjectMembersRequest.ScopeItem("discipline", "building")
                        )
                )
        )));
    }

    private UUID insertBillVersion(UUID projectId, String stageCode, String disciplineCode, String businessIdentity) {
        UUID id = UUID.randomUUID();
        Integer nextVersionNo = jdbcTemplate.queryForObject(
                "select coalesce(max(version_no), 0) + 1 from bill_version where project_id = ? and stage_code = ?",
                Integer.class,
                projectId,
                stageCode
        );
        jdbcTemplate.update("""
                insert into bill_version (
                    id, project_id, stage_code, discipline_code, business_identity,
                    version_no, version_type, version_status, lock_status, created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?, 'initial', 'editable', 'unlocked', now(), now())
                """,
                id, projectId, stageCode, disciplineCode, businessIdentity, nextVersionNo
        );
        return id;
    }
}
