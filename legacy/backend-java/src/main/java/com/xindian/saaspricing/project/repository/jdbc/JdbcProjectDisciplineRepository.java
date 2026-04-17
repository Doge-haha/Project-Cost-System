package com.xindian.saaspricing.project.repository.jdbc;

import com.xindian.saaspricing.discipline.dto.ProjectDisciplineResponse;
import com.xindian.saaspricing.project.repository.ProjectDisciplineRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public class JdbcProjectDisciplineRepository implements ProjectDisciplineRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcProjectDisciplineRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<ProjectDisciplineResponse> findByProjectId(UUID projectId) {
        return jdbcTemplate.query(
                "select * from project_discipline where project_id = ? order by sort_order asc",
                (rs, rowNum) -> mapDiscipline(rs),
                projectId
        );
    }

    @Override
    public void replaceProjectDisciplines(UUID projectId, List<ProjectDisciplineResponse> items) {
        jdbcTemplate.update("delete from project_discipline where project_id = ?", projectId);
        for (ProjectDisciplineResponse item : items) {
            jdbcTemplate.update("""
                    insert into project_discipline (
                        id, project_id, discipline_code, standard_set_code, sort_order, enabled, created_at, updated_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    item.id(),
                    item.projectId(),
                    item.disciplineCode(),
                    item.standardSetCode(),
                    item.sortOrder(),
                    item.isEnabled(),
                    item.createdAt(),
                    item.updatedAt()
            );
        }
    }

    private ProjectDisciplineResponse mapDiscipline(ResultSet rs) throws SQLException {
        return new ProjectDisciplineResponse(
                rs.getObject("id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("discipline_code"),
                rs.getString("standard_set_code"),
                rs.getInt("sort_order"),
                rs.getBoolean("enabled"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}

