package com.xindian.saaspricing.project.repository.jdbc;

import com.xindian.saaspricing.project.dto.StageResponse;
import com.xindian.saaspricing.project.enums.StageStatus;
import com.xindian.saaspricing.project.repository.ProjectStageRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

@Repository
public class JdbcProjectStageRepository implements ProjectStageRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcProjectStageRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<StageResponse> findByProjectId(UUID projectId) {
        return jdbcTemplate.query(
                "select * from project_stage where project_id = ? order by stage_order asc",
                (rs, rowNum) -> mapStage(rs),
                projectId
        );
    }

    @Override
    public void replaceProjectStages(UUID projectId, List<StageResponse> stages) {
        jdbcTemplate.update("delete from project_stage where project_id = ?", projectId);
        for (StageResponse stage : stages) {
            jdbcTemplate.update("""
                    insert into project_stage (
                        id, project_id, stage_code, stage_name, stage_order, stage_status, enabled,
                        owner_user_id, reviewer_user_id, ai_enabled, auto_flow_mode, created_at, updated_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now())
                    """,
                    stage.id(),
                    projectId,
                    stage.stageCode(),
                    stage.stageName(),
                    stage.sequenceNo(),
                    stage.status().name(),
                    stage.isEnabled(),
                    stage.assigneeUserId(),
                    stage.reviewerUserId(),
                    stage.aiEnabled(),
                    stage.autoFlowMode()
            );
        }
    }

    private StageResponse mapStage(ResultSet rs) throws SQLException {
        return new StageResponse(
                rs.getObject("id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("stage_code"),
                rs.getString("stage_name"),
                rs.getInt("stage_order"),
                StageStatus.valueOf(rs.getString("stage_status")),
                rs.getObject("owner_user_id", UUID.class),
                rs.getObject("reviewer_user_id", UUID.class),
                rs.getBoolean("ai_enabled"),
                rs.getString("auto_flow_mode"),
                rs.getBoolean("enabled")
        );
    }
}

