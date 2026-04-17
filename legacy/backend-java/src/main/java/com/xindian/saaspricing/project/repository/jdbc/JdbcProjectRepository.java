package com.xindian.saaspricing.project.repository.jdbc;

import com.xindian.saaspricing.project.dto.ProjectResponse;
import com.xindian.saaspricing.project.enums.ProjectStatus;
import com.xindian.saaspricing.project.repository.ProjectRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcProjectRepository implements ProjectRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcProjectRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public boolean existsByProjectCode(String projectCode) {
        Integer count = jdbcTemplate.queryForObject(
                "select count(1) from project where project_code = ?",
                Integer.class,
                projectCode
        );
        return count != null && count > 0;
    }

    @Override
    public void save(ProjectResponse project) {
        jdbcTemplate.update("""
                insert into project (
                    id, project_code, project_name, project_type, template_name, project_status,
                    owner_user_id, default_price_version_id, default_fee_template_id,
                    client_name, location_code, location_text, building_area, structure_type, description,
                    created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                project.id(),
                project.projectCode(),
                project.projectName(),
                project.projectType(),
                project.templateName(),
                project.status().name(),
                project.ownerUserId(),
                project.defaultPriceVersionId(),
                project.defaultFeeTemplateId(),
                project.clientName(),
                project.locationCode(),
                project.locationText(),
                project.buildingArea(),
                project.structureType(),
                project.description(),
                project.createdAt(),
                project.updatedAt()
        );
    }

    @Override
    public Optional<ProjectResponse> findById(UUID projectId) {
        return jdbcTemplate.query(
                "select * from project where id = ?",
                (rs, rowNum) -> mapProject(rs),
                projectId
        ).stream().findFirst();
    }

    private ProjectResponse mapProject(ResultSet rs) throws SQLException {
        return new ProjectResponse(
                rs.getObject("id", UUID.class),
                rs.getString("project_code"),
                rs.getString("project_name"),
                rs.getString("project_type"),
                rs.getString("template_name"),
                ProjectStatus.valueOf(rs.getString("project_status")),
                rs.getObject("owner_user_id", UUID.class),
                rs.getObject("default_price_version_id", UUID.class),
                rs.getObject("default_fee_template_id", UUID.class),
                rs.getString("client_name"),
                rs.getString("location_code"),
                rs.getString("location_text"),
                rs.getBigDecimal("building_area"),
                rs.getString("structure_type"),
                rs.getString("description"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}
