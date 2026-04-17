package com.xindian.saaspricing.project.repository.jdbc;

import com.xindian.saaspricing.project.dto.ProjectMemberResponse;
import com.xindian.saaspricing.project.repository.ProjectMemberRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
public class JdbcProjectMemberRepository implements ProjectMemberRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcProjectMemberRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<ProjectMemberResponse> findByProjectId(UUID projectId) {
        return jdbcTemplate.query(
                "select * from project_member where project_id = ? order by created_at asc",
                (rs, rowNum) -> mapMember(rs),
                projectId
        );
    }

    @Override
    public Optional<ProjectMemberResponse> findActiveMember(UUID projectId, UUID userId) {
        return jdbcTemplate.query(
                "select * from project_member where project_id = ? and user_id = ? and member_status = 'active'",
                (rs, rowNum) -> mapMember(rs),
                projectId,
                userId
        ).stream().findFirst();
    }

    @Override
    public void replaceProjectMembers(UUID projectId, List<ProjectMemberResponse> members) {
        List<UUID> existingMemberIds = jdbcTemplate.query(
                "select id from project_member where project_id = ?",
                (rs, rowNum) -> rs.getObject("id", UUID.class),
                projectId
        );
        for (UUID memberId : existingMemberIds) {
            jdbcTemplate.update("delete from project_role_scope where project_member_id = ?", memberId);
        }
        jdbcTemplate.update("delete from project_member where project_id = ?", projectId);

        for (ProjectMemberResponse member : members) {
            String primaryBusinessIdentity = member.businessIdentities().isEmpty() ? null : member.businessIdentities().get(0);
            jdbcTemplate.update("""
                    insert into project_member (
                        id, project_id, user_id, platform_role, business_identity, member_status, created_at, updated_at
                    ) values (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    member.id(),
                    member.projectId(),
                    member.userId(),
                    member.platformRole(),
                    primaryBusinessIdentity,
                    member.memberStatus(),
                    member.createdAt(),
                    member.updatedAt()
            );

            for (String identity : member.businessIdentities()) {
                jdbcTemplate.update("""
                        insert into project_role_scope (id, project_member_id, scope_type, scope_code, created_at)
                        values (?, ?, 'business_identity', ?, now())
                        """,
                        UUID.randomUUID(),
                        member.id(),
                        identity
                );
            }

            for (ProjectMemberResponse.RoleScopeResponse scope : member.scopes()) {
                jdbcTemplate.update("""
                        insert into project_role_scope (id, project_member_id, scope_type, scope_code, created_at)
                        values (?, ?, ?, ?, now())
                        """,
                        UUID.randomUUID(),
                        member.id(),
                        scope.scopeType(),
                        scope.scopeCode()
                );
            }
        }
    }

    private ProjectMemberResponse mapMember(ResultSet rs) throws SQLException {
        UUID memberId = rs.getObject("id", UUID.class);
        List<ProjectMemberResponse.RoleScopeResponse> scopes = jdbcTemplate.query(
                "select scope_type, scope_code from project_role_scope where project_member_id = ?",
                (scopeRs, rowNum) -> new ProjectMemberResponse.RoleScopeResponse(
                        scopeRs.getString("scope_type"),
                        scopeRs.getString("scope_code")
                ),
                memberId
        );
        List<String> businessIdentities = scopes.stream()
                .filter(scope -> "business_identity".equals(scope.scopeType()))
                .map(ProjectMemberResponse.RoleScopeResponse::scopeCode)
                .collect(Collectors.toList());
        List<ProjectMemberResponse.RoleScopeResponse> businessScopes = scopes.stream()
                .filter(scope -> !"business_identity".equals(scope.scopeType()))
                .toList();
        return new ProjectMemberResponse(
                memberId,
                rs.getObject("project_id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getString("platform_role"),
                businessIdentities,
                rs.getString("member_status"),
                businessScopes,
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class)
        );
    }
}

