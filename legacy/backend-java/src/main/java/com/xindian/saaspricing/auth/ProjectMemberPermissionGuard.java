package com.xindian.saaspricing.auth;

import com.xindian.saaspricing.common.exception.NotFoundException;
import com.xindian.saaspricing.project.dto.ProjectMemberResponse;
import com.xindian.saaspricing.project.repository.ProjectMemberRepository;
import com.xindian.saaspricing.project.repository.ProjectRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;

@Component
public class ProjectMemberPermissionGuard implements ProjectPermissionGuard {

    private final CurrentUserProvider currentUserProvider;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public ProjectMemberPermissionGuard(
            CurrentUserProvider currentUserProvider,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository
    ) {
        this.currentUserProvider = currentUserProvider;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    @Override
    public void assertCanViewProject(UUID projectId) {
        ensureProjectExists(projectId);
        currentUserProvider.currentUserId().ifPresent(userId -> {
            requireActiveMember(projectId, userId, "无权访问该项目");
        });
    }

    @Override
    public void assertCanViewProjectStage(UUID projectId, String stageCode) {
        ensureProjectExists(projectId);
        currentUserProvider.currentUserId().ifPresent(userId -> {
            ProjectMemberResponse member = requireActiveMember(projectId, userId, "无权访问该项目阶段");
            if (isPrivilegedMember(member)) {
                return;
            }
            assertScopeAllowed(member, "stage", stageCode, "当前成员无该阶段访问权限");
        });
    }

    @Override
    public void assertCanViewProjectDiscipline(UUID projectId, String disciplineCode) {
        ensureProjectExists(projectId);
        currentUserProvider.currentUserId().ifPresent(userId -> {
            ProjectMemberResponse member = requireActiveMember(projectId, userId, "无权访问该项目专业");
            if (isPrivilegedMember(member)) {
                return;
            }
            assertScopeAllowed(member, "discipline", disciplineCode, "当前成员无该专业访问权限");
        });
    }

    @Override
    public void assertCanUseBusinessIdentity(UUID projectId, String businessIdentity) {
        ensureProjectExists(projectId);
        currentUserProvider.currentUserId().ifPresent(userId -> {
            ProjectMemberResponse member = requireActiveMember(projectId, userId, "无权以当前业务身份执行操作");
            if (isPrivilegedMember(member)) {
                return;
            }
            if (businessIdentity == null || businessIdentity.isBlank()) {
                return;
            }
            if (member.businessIdentities().isEmpty()) {
                return;
            }
            boolean matched = member.businessIdentities().stream()
                    .anyMatch(Predicate.isEqual(businessIdentity));
            if (!matched) {
                throw new AccessDeniedException("当前成员无该业务身份权限");
            }
        });
    }

    @Override
    public void assertCanEditProject(UUID projectId) {
        ensureProjectExists(projectId);
        currentUserProvider.currentUserId().ifPresent(userId -> {
            ProjectMemberResponse member = requireActiveMember(projectId, userId, "无权编辑该项目");
            if (!isPrivilegedMember(member)) {
                throw new AccessDeniedException("当前成员无编辑权限");
            }
        });
    }

    @Override
    public void assertCanEditProjectStage(UUID projectId, String stageCode) {
        ensureProjectExists(projectId);
        currentUserProvider.currentUserId().ifPresent(userId -> {
            ProjectMemberResponse member = requireActiveMember(projectId, userId, "无权编辑该项目阶段");
            if (isPrivilegedMember(member)) {
                return;
            }
            if (!canContribute(member)) {
                throw new AccessDeniedException("当前成员无阶段编辑权限");
            }
            assertScopeAllowed(member, "stage", stageCode, "当前成员无该阶段编辑权限");
        });
    }

    @Override
    public void assertCanEditProjectDiscipline(UUID projectId, String disciplineCode) {
        ensureProjectExists(projectId);
        currentUserProvider.currentUserId().ifPresent(userId -> {
            ProjectMemberResponse member = requireActiveMember(projectId, userId, "无权编辑该项目专业数据");
            if (isPrivilegedMember(member)) {
                return;
            }
            if (!canContribute(member)) {
                throw new AccessDeniedException("当前成员无专业编辑权限");
            }
            assertScopeAllowed(member, "discipline", disciplineCode, "当前成员无该专业编辑权限");
        });
    }

    @Override
    public void assertCanViewStandardSets() {
        currentUserProvider.currentUserId().ifPresent(userId -> {
            // V1 先允许任何已登录用户查看定额集；项目内权限在具体接口按项目再约束。
        });
    }

    private void ensureProjectExists(UUID projectId) {
        if (projectRepository.findById(projectId).isEmpty()) {
            throw new NotFoundException("项目不存在");
        }
    }

    private ProjectMemberResponse requireActiveMember(UUID projectId, UUID userId, String message) {
        ProjectMemberResponse member = projectMemberRepository.findActiveMember(projectId, userId)
                .orElseThrow(() -> new AccessDeniedException(message));
        if (!"active".equals(member.memberStatus())) {
            throw new AccessDeniedException("项目成员状态不可用");
        }
        return member;
    }

    private boolean isPrivilegedMember(ProjectMemberResponse member) {
        return List.of("project_owner", "system_admin").contains(member.platformRole());
    }

    private boolean canContribute(ProjectMemberResponse member) {
        return List.of("project_owner", "system_admin", "cost_engineer").contains(member.platformRole());
    }

    private void assertScopeAllowed(
            ProjectMemberResponse member,
            String scopeType,
            String scopeCode,
            String message
    ) {
        if (scopeCode == null || scopeCode.isBlank()) {
            return;
        }
        List<ProjectMemberResponse.RoleScopeResponse> typedScopes = member.scopes().stream()
                .filter(scope -> scopeType.equals(scope.scopeType()))
                .toList();
        if (typedScopes.isEmpty()) {
            return;
        }
        boolean matched = typedScopes.stream()
                .map(ProjectMemberResponse.RoleScopeResponse::scopeCode)
                .anyMatch(Predicate.isEqual(scopeCode));
        if (!matched) {
            throw new AccessDeniedException(message);
        }
    }
}
