package com.xindian.saaspricing.project.service;

import com.xindian.saaspricing.bootstrap.SaasPricingApplication;
import com.xindian.saaspricing.project.dto.CreateProjectRequest;
import com.xindian.saaspricing.project.dto.ProjectResponse;
import com.xindian.saaspricing.project.dto.WorkspaceResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@ActiveProfiles("test")
@SpringBootTest(classes = SaasPricingApplication.class)
class ProjectApplicationServiceTests {

    @Autowired
    private ProjectApplicationService projectApplicationService;

    @Autowired
    private ProjectStageService projectStageService;

    @Test
    void shouldCreateProjectAndExpandDefaultStages() {
        ProjectResponse project = projectApplicationService.createProject(new CreateProjectRequest(
                "PRJ-001",
                "测试项目",
                "全过程咨询",
                "标准九阶段模板",
                UUID.randomUUID(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        ));

        WorkspaceResponse workspace = projectApplicationService.getWorkspace(project.id(), null);

        assertNotNull(project.id());
        assertEquals(9, projectStageService.getStages(project.id()).size());
        assertEquals("stage_01", workspace.currentStage().stageCode());
    }
}
