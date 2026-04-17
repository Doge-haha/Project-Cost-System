package com.xindian.saaspricing.bill.repository.jdbc;

import com.xindian.saaspricing.bill.dto.BillVersionContext;
import com.xindian.saaspricing.bill.dto.BillVersionResponse;
import com.xindian.saaspricing.bill.repository.BillVersionRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcBillVersionRepository implements BillVersionRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcBillVersionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<BillVersionContext> findById(UUID billVersionId) {
        return jdbcTemplate.query("""
                        select id, project_id, stage_code, discipline_code, business_identity,
                               version_no, version_type, version_status, lock_status, source_stage_code, source_version_id
                        from bill_version
                        where id = ?
                        """,
                (rs, rowNum) -> new BillVersionContext(
                        rs.getObject("id", UUID.class),
                        rs.getObject("project_id", UUID.class),
                        rs.getString("stage_code"),
                        rs.getString("discipline_code"),
                        rs.getString("business_identity"),
                        rs.getInt("version_no"),
                        rs.getString("version_type"),
                        rs.getString("version_status"),
                        rs.getString("lock_status"),
                        rs.getString("source_stage_code"),
                        rs.getObject("source_version_id", UUID.class)
                ),
                billVersionId
        ).stream().findFirst();
    }

    @Override
    public List<BillVersionResponse> findByProjectId(UUID projectId, String stageCode, String disciplineCode) {
        StringBuilder sql = new StringBuilder("""
                select *
                  from bill_version
                 where project_id = ?
                """);
        List<Object> args = new ArrayList<>();
        args.add(projectId);
        if (stageCode != null && !stageCode.isBlank()) {
            sql.append(" and stage_code = ?");
            args.add(stageCode);
        }
        if (disciplineCode != null && !disciplineCode.isBlank()) {
            sql.append(" and discipline_code = ?");
            args.add(disciplineCode);
        }
        sql.append(" order by stage_code asc, version_no asc");
        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> mapResponse(rs), args.toArray());
    }

    @Override
    public int nextVersionNo(UUID projectId, String stageCode) {
        Integer max = jdbcTemplate.queryForObject(
                "select coalesce(max(version_no), 0) from bill_version where project_id = ? and stage_code = ?",
                Integer.class,
                projectId,
                stageCode
        );
        return (max == null ? 0 : max) + 1;
    }

    @Override
    public BillVersionResponse save(BillVersionResponse billVersion) {
        jdbcTemplate.update("""
                insert into bill_version (
                    id, project_id, stage_code, discipline_code, business_identity,
                    version_no, version_type, version_status, lock_status,
                    source_stage_code, source_version_id, created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                billVersion.id(), billVersion.projectId(), billVersion.stageCode(), billVersion.disciplineCode(),
                billVersion.businessIdentity(), billVersion.versionNo(), billVersion.versionType(),
                billVersion.versionStatus(), billVersion.lockStatus(), billVersion.sourceStageCode(),
                billVersion.sourceVersionId(), billVersion.createdAt(), billVersion.updatedAt()
        );
        return billVersion;
    }

    @Override
    public BillVersionResponse updateLockStatus(UUID versionId, String lockStatus) {
        jdbcTemplate.update("""
                update bill_version
                   set lock_status = ?, updated_at = now()
                 where id = ?
                """, lockStatus, versionId);
        return jdbcTemplate.query(
                "select * from bill_version where id = ?",
                (rs, rowNum) -> mapResponse(rs),
                versionId
        ).stream().findFirst().orElseThrow();
    }

    @Override
    public BillVersionResponse updateVersionStatus(UUID versionId, String versionStatus) {
        jdbcTemplate.update("""
                update bill_version
                   set version_status = ?, updated_at = now()
                 where id = ?
                """, versionStatus, versionId);
        return jdbcTemplate.query(
                "select * from bill_version where id = ?",
                (rs, rowNum) -> mapResponse(rs),
                versionId
        ).stream().findFirst().orElseThrow();
    }

    private BillVersionResponse mapResponse(ResultSet rs) throws SQLException {
        return new BillVersionResponse(
                rs.getObject("id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("stage_code"),
                rs.getString("discipline_code"),
                rs.getString("business_identity"),
                rs.getInt("version_no"),
                rs.getString("version_type"),
                rs.getString("version_status"),
                rs.getString("lock_status"),
                rs.getString("source_stage_code"),
                rs.getObject("source_version_id", UUID.class),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}
