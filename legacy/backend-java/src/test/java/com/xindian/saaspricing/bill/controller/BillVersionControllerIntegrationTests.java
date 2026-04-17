package com.xindian.saaspricing.bill.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xindian.saaspricing.bootstrap.SaasPricingApplication;
import com.xindian.saaspricing.bill.dto.CreateBillItemRequest;
import com.xindian.saaspricing.bill.dto.CreateBillItemWorkItemRequest;
import com.xindian.saaspricing.bill.dto.CreateBillVersionRequest;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@AutoConfigureMockMvc
@SpringBootTest(classes = SaasPricingApplication.class)
class BillVersionControllerIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ProjectApplicationService projectApplicationService;

    @Autowired
    private ProjectDisciplineService projectDisciplineService;

    @Autowired
    private ProjectMemberService projectMemberService;

    @Test
    void scopedCostEngineerCanCreateAndListBillVersionsInsideAuthorizedContext() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        CreateBillVersionRequest request = new CreateBillVersionRequest(
                "stage_01",
                "building",
                "consultant",
                "initial",
                null
        );

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.stageCode").value("stage_01"))
                .andExpect(jsonPath("$.disciplineCode").value("building"))
                .andExpect(jsonPath("$.versionNo").value(1));

        mockMvc.perform(get("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .param("stageCode", "stage_01")
                        .param("disciplineCode", "building"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].businessIdentity").value("consultant"));
    }

    @Test
    void scopedCostEngineerCannotCreateBillVersionOutsideAuthorizedContext() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        CreateBillVersionRequest request = new CreateBillVersionRequest(
                "stage_02",
                "building",
                "consultant",
                "initial",
                null
        );

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void scopedCostEngineerCannotListBillVersionsOutsideAuthorizedStage() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_02",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .param("stageCode", "stage_02")
                        .param("disciplineCode", "building"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void scopedCostEngineerCanCopyFromAuthorizedSourceVersion() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String sourceVersionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String sourceVersionId = objectMapper.readTree(sourceVersionJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/copy-from", project.id(), sourceVersionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceVersionId").value(sourceVersionId))
                .andExpect(jsonPath("$.sourceStageCode").value("stage_01"))
                .andExpect(jsonPath("$.versionNo").value(2));
    }

    @Test
    void scopedCostEngineerCanReadSourceChainInsideAuthorizedContext() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String sourceVersionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String sourceVersionId = objectMapper.readTree(sourceVersionJson).get("id").asText();

        String copiedJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/copy-from", project.id(), sourceVersionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String copiedId = objectMapper.readTree(copiedJson).get("id").asText();

        mockMvc.perform(get("/api/v1/projects/{id}/bill-versions/{versionId}/source-chain", project.id(), copiedId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(copiedId))
                .andExpect(jsonPath("$.items[1].id").value(sourceVersionId));
    }

    @Test
    void scopedCostEngineerCannotCopyFromUnauthorizedSourceVersion() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String sourceVersionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_02",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String sourceVersionId = objectMapper.readTree(sourceVersionJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/copy-from", project.id(), sourceVersionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void copyFromAlsoClonesBillItemsAndWorkItems() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String sourceVersionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String sourceVersionId = objectMapper.readTree(sourceVersionJson).get("id").asText();

        String sourceItemJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                UUID.fromString(sourceVersionId),
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
                                java.math.BigDecimal.ONE,
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

        String sourceItemId = objectMapper.readTree(sourceItemJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items/{itemId}/work-items", project.id(), sourceItemId)
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemWorkItemRequest(
                                null,
                                null,
                                1,
                                "人工清槽"
                        ))))
                .andExpect(status().isCreated());

        String copiedJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/copy-from", project.id(), sourceVersionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String copiedVersionId = objectMapper.readTree(copiedJson).get("id").asText();

        String copiedItemsJson = mockMvc.perform(get("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .param("billVersionId", copiedVersionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].itemCode").value("010101001"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        String copiedItemId = objectMapper.readTree(copiedItemsJson).get("items").get(0).get("id").asText();

        mockMvc.perform(get("/api/v1/projects/{id}/bill-items/{itemId}/work-items", project.id(), copiedItemId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].workContent").value("人工清槽"));
    }

    @Test
    void copyFromPreservesBillItemTreeStructure() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String sourceVersionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        UUID sourceVersionId = UUID.fromString(objectMapper.readTree(sourceVersionJson).get("id").asText());

        String parentJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                sourceVersionId,
                                null,
                                1,
                                1,
                                "010101010",
                                "父节点",
                                "项",
                                null,
                                null,
                                "L1",
                                false,
                                java.math.BigDecimal.ONE,
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
                                sourceVersionId,
                                parentId,
                                2,
                                2,
                                "010101011",
                                "子节点",
                                "m3",
                                null,
                                null,
                                "L1.1",
                                false,
                                java.math.BigDecimal.TEN,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null
                        ))))
                .andExpect(status().isCreated());

        String copiedJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/copy-from", project.id(), sourceVersionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String copiedVersionId = objectMapper.readTree(copiedJson).get("id").asText();
        String copiedItemsJson = mockMvc.perform(get("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .param("billVersionId", copiedVersionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andReturn()
                .getResponse()
                .getContentAsString();

        var items = objectMapper.readTree(copiedItemsJson).get("items");
        var copiedParent = findItemByCode(items, "010101010");
        var copiedChild = findItemByCode(items, "010101011");

        org.junit.jupiter.api.Assertions.assertNotNull(copiedParent);
        org.junit.jupiter.api.Assertions.assertNotNull(copiedChild);
        org.junit.jupiter.api.Assertions.assertTrue(copiedChild.hasNonNull("parentId"));
        org.junit.jupiter.api.Assertions.assertEquals(
                copiedParent.get("id").asText(),
                copiedChild.get("parentId").asText()
        );
        org.junit.jupiter.api.Assertions.assertNotEquals(
                parentId.toString(),
                copiedChild.get("parentId").asText()
        );
    }

    @Test
    void ownerCanLockVersionAndLockedVersionRejectsBillItemWrites() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/lock", project.id(), versionId)
                        .header("X-User-Id", ownerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lockStatus").value("locked"));

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                UUID.fromString(versionId),
                                null,
                                1,
                                1,
                                "010101003",
                                "锁定后新增",
                                "m3",
                                null,
                                null,
                                null,
                                false,
                                java.math.BigDecimal.ONE,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null
                        ))))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("RESOURCE_LOCKED"));
    }

    @Test
    void lockedVersionRejectsBillItemUpdatesAndWorkItemWrites() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        UUID versionId = UUID.fromString(objectMapper.readTree(versionJson).get("id").asText());

        String itemJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                versionId,
                                null,
                                1,
                                1,
                                "010101004",
                                "待锁定清单项",
                                "m3",
                                null,
                                null,
                                null,
                                false,
                                java.math.BigDecimal.ONE,
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

        UUID itemId = UUID.fromString(objectMapper.readTree(itemJson).get("id").asText());

        String workItemJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-items/{itemId}/work-items", project.id(), itemId)
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemWorkItemRequest(
                                null,
                                null,
                                1,
                                "原始工作内容"
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        UUID workItemId = UUID.fromString(objectMapper.readTree(workItemJson).get("id").asText());

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/lock", project.id(), versionId)
                        .header("X-User-Id", ownerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lockStatus").value("locked"));

        mockMvc.perform(put("/api/v1/projects/{id}/bill-items/{itemId}", project.id(), itemId)
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"itemName":"锁定后修改"}
                                """))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("RESOURCE_LOCKED"));

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items/{itemId}/work-items", project.id(), itemId)
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemWorkItemRequest(
                                null,
                                null,
                                2,
                                "锁定后新增工作内容"
                        ))))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("RESOURCE_LOCKED"));

        mockMvc.perform(put("/api/v1/projects/{id}/bill-items/{itemId}/work-items/{workItemId}", project.id(), itemId, workItemId)
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemWorkItemRequest(
                                null,
                                null,
                                1,
                                "锁定后更新工作内容"
                        ))))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("RESOURCE_LOCKED"));
    }

    @Test
    void nonOwnerCannotLockVersion() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/lock", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void scopedCostEngineerCanSubmitVersionAndSubmittedVersionRejectsWrites() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        createBillItem(project.id(), engineerUserId, UUID.fromString(versionId), "010101008", "提交前清单项");

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/submit", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionStatus").value("submitted"));

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                UUID.fromString(versionId),
                                null,
                                1,
                                1,
                                "010101009",
                                "提交后新增",
                                "m3",
                                null,
                                null,
                                null,
                                false,
                                java.math.BigDecimal.ONE,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null
                        ))))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("RESOURCE_LOCKED"));
    }

    @Test
    void scopedCostEngineerCannotSubmitVersionOutsideAuthorizedContext() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_02",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/submit", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void lockedVersionCannotBeSubmitted() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", ownerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/lock", project.id(), versionId)
                        .header("X-User-Id", ownerUserId))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/submit", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("RESOURCE_LOCKED"));
    }

    @Test
    void scopedCostEngineerCanWithdrawSubmittedVersionAndWritesResume() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        createBillItem(project.id(), engineerUserId, UUID.fromString(versionId), "010101011", "撤回前清单项");

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/submit", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionStatus").value("submitted"));

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/withdraw", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionStatus").value("editable"));

        String itemJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                UUID.fromString(versionId),
                                null,
                                1,
                                1,
                                "010101010",
                                "撤回后新增",
                                "m3",
                                null,
                                null,
                                null,
                                false,
                                java.math.BigDecimal.ONE,
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

        String itemId = objectMapper.readTree(itemJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items/{itemId}/work-items", project.id(), itemId)
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemWorkItemRequest(
                                null,
                                null,
                                1,
                                "基础工作内容"
                        ))))
                .andExpect(status().isCreated());
    }

    @Test
    void nonSubmittedVersionCannotBeWithdrawn() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/withdraw", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void lockedSubmittedVersionCannotBeWithdrawn() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        createBillItem(project.id(), engineerUserId, UUID.fromString(versionId), "010101012", "锁定撤回前清单项");

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/submit", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/lock", project.id(), versionId)
                        .header("X-User-Id", ownerUserId))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/withdraw", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("RESOURCE_LOCKED"));
    }

    @Test
    void validationSummaryReportsBlockingErrorForEmptyVersion() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        mockMvc.perform(get("/api/v1/projects/{id}/bill-versions/{versionId}/validation-summary", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passed").value(false))
                .andExpect(jsonPath("$.errorCount").value(1))
                .andExpect(jsonPath("$.issues[0].code").value("EMPTY_VERSION"))
                .andExpect(jsonPath("$.issues[0].severity").value("error"));
    }

    @Test
    void validationSummaryPassesForEditableVersionWithBillItems() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        String itemJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-items", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                UUID.fromString(versionId),
                                null,
                                1,
                                1,
                                "010101099",
                                "校验通过清单项",
                                "m3",
                                null,
                                null,
                                null,
                                false,
                                java.math.BigDecimal.ONE,
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

        String itemId = objectMapper.readTree(itemJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-items/{itemId}/work-items", project.id(), itemId)
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemWorkItemRequest(
                                null,
                                null,
                                1,
                                "基础工作内容"
                        ))))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/projects/{id}/bill-versions/{versionId}/validation-summary", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passed").value(true))
                .andExpect(jsonPath("$.errorCount").value(0))
                .andExpect(jsonPath("$.warningCount").value(0))
                .andExpect(jsonPath("$.issues.length()").value(0));
    }

    @Test
    void validationSummaryReportsWarningsForItemsWithoutWorkItems() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();
        createBillItem(project.id(), engineerUserId, UUID.fromString(versionId), "010101100", "缺工作内容清单项");

        mockMvc.perform(get("/api/v1/projects/{id}/bill-versions/{versionId}/validation-summary", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passed").value(true))
                .andExpect(jsonPath("$.errorCount").value(0))
                .andExpect(jsonPath("$.warningCount").value(1))
                .andExpect(jsonPath("$.issues[0].code").value("MISSING_WORK_ITEMS"))
                .andExpect(jsonPath("$.issues[0].severity").value("warning"))
                .andExpect(jsonPath("$.issues[0].itemCode").value("010101100"))
                .andExpect(jsonPath("$.issues[0].itemId").isNotEmpty());
    }

    @Test
    void submitRejectsEmptyVersionUsingSameValidationRules() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/submit", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details.issues[0].code").value("EMPTY_VERSION"));
    }

    @Test
    void validationSummaryReportsBlockingErrorForDuplicateItemCodes() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        UUID versionId = UUID.fromString(objectMapper.readTree(versionJson).get("id").asText());
        createBillItem(project.id(), engineerUserId, versionId, "010101102", "重复编码一");
        createBillItem(project.id(), engineerUserId, versionId, "010101102", "重复编码二");

        mockMvc.perform(get("/api/v1/projects/{id}/bill-versions/{versionId}/validation-summary", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.passed").value(false))
                .andExpect(jsonPath("$.errorCount").value(1))
                .andExpect(jsonPath("$.issues[0].code").value("DUPLICATE_ITEM_CODE"))
                .andExpect(jsonPath("$.issues[0].severity").value("error"))
                .andExpect(jsonPath("$.issues[0].itemCode").value("010101102"));
    }

    @Test
    void submitAllowsWarningsAndStillTransitionsToSubmitted() throws Exception {
        UUID ownerUserId = UUID.randomUUID();
        UUID engineerUserId = UUID.randomUUID();
        ProjectResponse project = createProject(ownerUserId);
        enableBuildingDiscipline(project.id());
        replaceMembers(project.id(), ownerUserId, engineerUserId, "cost_engineer", "consultant");

        String versionJson = mockMvc.perform(post("/api/v1/projects/{id}/bill-versions", project.id())
                        .header("X-User-Id", engineerUserId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillVersionRequest(
                                "stage_01",
                                "building",
                                "consultant",
                                "initial",
                                null
                        ))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        String versionId = objectMapper.readTree(versionJson).get("id").asText();
        createBillItem(project.id(), engineerUserId, UUID.fromString(versionId), "010101101", "仅有warning的清单项");

        mockMvc.perform(post("/api/v1/projects/{id}/bill-versions/{versionId}/submit", project.id(), versionId)
                        .header("X-User-Id", engineerUserId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versionStatus").value("submitted"));
    }

    private ProjectResponse createProject(UUID ownerUserId) {
        return projectApplicationService.createProject(new CreateProjectRequest(
                "PRJ-" + UUID.randomUUID().toString().substring(0, 8),
                "清单版本接口测试项目",
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

    private com.fasterxml.jackson.databind.JsonNode findItemByCode(com.fasterxml.jackson.databind.JsonNode items, String itemCode) {
        for (com.fasterxml.jackson.databind.JsonNode item : items) {
            if (itemCode.equals(item.get("itemCode").asText())) {
                return item;
            }
        }
        return null;
    }

    private void createBillItem(UUID projectId, UUID userId, UUID versionId, String itemCode, String itemName) throws Exception {
        mockMvc.perform(post("/api/v1/projects/{id}/bill-items", projectId)
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateBillItemRequest(
                                versionId,
                                null,
                                1,
                                1,
                                itemCode,
                                itemName,
                                "m3",
                                null,
                                null,
                                null,
                                false,
                                java.math.BigDecimal.ONE,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null
                        ))))
                .andExpect(status().isCreated());
    }
}
