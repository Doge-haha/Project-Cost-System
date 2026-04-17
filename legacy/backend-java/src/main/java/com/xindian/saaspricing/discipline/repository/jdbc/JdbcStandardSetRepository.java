package com.xindian.saaspricing.discipline.repository.jdbc;

import com.xindian.saaspricing.discipline.dto.StandardSetResponse;
import com.xindian.saaspricing.discipline.repository.StandardSetRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

@Repository
public class JdbcStandardSetRepository implements StandardSetRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcStandardSetRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<StandardSetResponse> findAll(String disciplineCode, String regionCode, String status) {
        return jdbcTemplate.query("select * from standard_set order by standard_set_code asc",
                (rs, rowNum) -> mapStandardSet(rs)).stream()
                .filter(item -> disciplineCode == null || disciplineCode.isBlank() || disciplineCode.equals(item.disciplineCode()))
                .filter(item -> regionCode == null || regionCode.isBlank() || regionCode.equals(item.regionCode()))
                .filter(item -> status == null || status.isBlank() || status.equals(item.status()))
                .toList();
    }

    private StandardSetResponse mapStandardSet(ResultSet rs) throws SQLException {
        return new StandardSetResponse(
                rs.getObject("id", UUID.class),
                rs.getString("standard_set_code"),
                rs.getString("standard_set_name"),
                rs.getString("discipline_code"),
                rs.getInt("standard_year"),
                rs.getString("standard_type"),
                rs.getString("region_code"),
                rs.getString("source_system"),
                rs.getString("status")
        );
    }
}

