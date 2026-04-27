import { requireDependency } from "../../shared/dependency/require-dependency.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { PaginationEnvelope } from "../../shared/http/pagination.js";
import type { ProjectRepository, ProjectRecord } from "./project-repository.js";
import type {
  ProjectStageRecord,
  ProjectStageRepository,
} from "./project-stage-repository.js";
import type {
  ProjectDisciplineRecord,
  ProjectDisciplineRepository,
} from "./project-discipline-repository.js";
import type {
  ProjectMemberRecord,
  ProjectMemberRepository,
} from "./project-member-repository.js";
import { ProjectAuthorizationService } from "./project-authorization-service.js";
import type { PriceVersionRepository } from "../pricing/price-version-repository.js";
import type { FeeTemplateRepository } from "../fee/fee-template-repository.js";
import type { AuditLogService } from "../audit/audit-log-service.js";
import type {
  BillVersionRecord,
  BillVersionRepository,
} from "../bill/bill-version-repository.js";
import type {
  ReviewSubmissionRecord,
  ReviewSubmissionRepository,
} from "../review/review-submission-repository.js";
import type {
  ProcessDocumentRecord,
  ProcessDocumentRepository,
} from "../process/process-document-repository.js";
import type {
  BackgroundJobRecord,
  BackgroundJobRepository,
} from "../jobs/background-job-repository.js";
import type {
  ImportTaskRecord,
  ImportTaskRepository,
} from "../import/import-task-repository.js";

export type ProjectWorkspacePermissionSummary = {
  roleCode: string;
  roleLabel: string;
  canManageProject: boolean;
  canEditProject: boolean;
  scopeSummary: string[];
  visibleStageCodes: string[];
  visibleDisciplineCodes: string[];
};

export type ProjectWorkspaceRecord = {
  project: ProjectRecord;
  currentStage: ProjectStageRecord | null;
  availableStages: ProjectStageRecord[];
  disciplines: ProjectDisciplineRecord[];
  billVersions: BillVersionRecord[];
  todoSummary: {
    totalCount: number;
    pendingReviewCount: number;
    pendingProcessDocumentCount: number;
    draftProcessDocumentCount: number;
    items: string[];
  };
  riskSummary: {
    totalCount: number;
    rejectedReviewCount: number;
    rejectedProcessDocumentCount: number;
    failedJobCount: number;
    items: string[];
  };
  importStatus: {
    mode: "import_task";
    totalCount: number;
    queuedCount: number;
    processingCount: number;
    completedCount: number;
    failedCount: number;
    latestTask: {
      id: string;
      sourceType: string;
      sourceLabel: string;
      status: string;
      createdAt: string;
    } | null;
    note: string;
  };
  currentUser: {
    userId: string;
    displayName: string;
    memberId: string | null;
    permissionSummary: ProjectWorkspacePermissionSummary;
  };
};

export class ProjectService {
  private readonly auditLogService: AuditLogService;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly projectStageRepository: ProjectStageRepository,
    private readonly projectDisciplineRepository: ProjectDisciplineRepository,
    private readonly projectMemberRepository: ProjectMemberRepository,
    private readonly billVersionRepository?: BillVersionRepository,
    private readonly reviewSubmissionRepository?: ReviewSubmissionRepository,
    private readonly processDocumentRepository?: ProcessDocumentRepository,
    private readonly backgroundJobRepository?: BackgroundJobRepository,
    private readonly importTaskRepository?: ImportTaskRepository,
    private readonly priceVersionRepository?: PriceVersionRepository,
    private readonly feeTemplateRepository?: FeeTemplateRepository,
    auditLogService?: AuditLogService,
  ) {
    this.auditLogService = requireDependency(
      auditLogService,
      "auditLogService",
    );
  }

  async listProjects(input: {
    page: number;
    pageSize: number;
    userId: string;
    roleCodes: string[];
  }): Promise<{
    items: ProjectRecord[];
    pagination: PaginationEnvelope;
  }> {
    const result = await this.projectRepository.listPage(input);
    const canViewAllProjects = input.roleCodes.includes("system_admin");
    const memberships = canViewAllProjects
      ? []
      : await this.projectMemberRepository.listByUserId(input.userId);
    const visibleProjectIds = new Set(
      memberships.map((membership) => membership.projectId),
    );
    const items = canViewAllProjects
      ? result.items
      : result.items.filter((project) => visibleProjectIds.has(project.id));

    return {
      items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        total: canViewAllProjects ? result.total : visibleProjectIds.size,
      },
    };
  }

  async getProject(input: {
    projectId: string;
    userId: string;
    roleCodes: string[];
  }): Promise<ProjectRecord> {
    const projectId = input.projectId;
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }

    await this.assertCanViewProject({
      projectId,
      userId: input.userId,
      roleCodes: input.roleCodes,
    });

    return project;
  }

  async getProjectWorkspace(input: {
    projectId: string;
    stageCode?: string;
    userId: string;
    userDisplayName: string;
    roleCodes: string[];
  }): Promise<ProjectWorkspaceRecord> {
    const project = await this.getProject({
      projectId: input.projectId,
      userId: input.userId,
      roleCodes: input.roleCodes,
    });
    const [stages, disciplines, members] = await Promise.all([
      this.projectStageRepository.listByProjectId(input.projectId),
      this.projectDisciplineRepository.listByProjectId(input.projectId),
      this.projectMemberRepository.listByProjectId(input.projectId),
    ]);
    const authorizationService = new ProjectAuthorizationService({
      stages,
      disciplines,
      members,
    });
    const currentMember = members.find((member) => member.userId === input.userId) ?? null;
    const currentStage = this.pickCurrentStage(stages, input.stageCode);
    const enabledDisciplines = disciplines.filter(
      (discipline) => discipline.status === "enabled",
    );
    const [todoSummary, riskSummary, importStatus] = await Promise.all([
      this.buildTodoSummary({
        projectId: input.projectId,
        authorizationService,
        userId: input.userId,
      }),
      this.buildRiskSummary({
        projectId: input.projectId,
        authorizationService,
        userId: input.userId,
      }),
      this.buildImportStatus(input.projectId),
    ]);
    const visibleBillVersions = await this.listVisibleBillVersions({
      projectId: input.projectId,
      authorizationService,
      roleCodes: input.roleCodes,
      userId: input.userId,
    });

    return {
      project,
      currentStage,
      availableStages: stages,
      disciplines: enabledDisciplines,
      billVersions: visibleBillVersions,
      todoSummary,
      riskSummary,
      importStatus,
      currentUser: {
        userId: input.userId,
        displayName: input.userDisplayName,
        memberId: currentMember?.id ?? null,
        permissionSummary: this.buildPermissionSummary({
          projectId: input.projectId,
          roleCodes: input.roleCodes,
          stages,
          disciplines: enabledDisciplines,
          currentMember,
          authorizationService,
          userId: input.userId,
        }),
      },
    };
  }

  async createProject(input: {
    code: string;
    name: string;
    defaultPriceVersionId?: string | null;
    defaultFeeTemplateId?: string | null;
    stages: Array<{
      stageCode: string;
      stageName: string;
      status: ProjectStageRecord["status"];
      sequenceNo: number;
    }>;
    userId: string;
    userDisplayName: string;
  }): Promise<{
    project: ProjectRecord;
    stages: ProjectStageRecord[];
    members: ProjectMemberRecord[];
  }> {
    this.assertCanCreateProject(input.userId);
    this.validateStageSetup(input.stages);
    await this.validatePricingDefaults({
      defaultPriceVersionId: input.defaultPriceVersionId,
      defaultFeeTemplateId: input.defaultFeeTemplateId,
    });

    const project = await this.projectRepository.create({
      code: input.code,
      name: input.name,
      status: "draft",
      defaultPriceVersionId: input.defaultPriceVersionId,
      defaultFeeTemplateId: input.defaultFeeTemplateId,
    });
    const stages = await this.projectStageRepository.replaceByProjectId(
      project.id,
      input.stages,
    );
    const members = await this.projectMemberRepository.replaceByProjectId(project.id, [
      {
        userId: input.userId,
        displayName: input.userDisplayName,
        roleCode: "project_owner",
        scopes: [
          {
            scopeType: "project",
            scopeValue: project.id,
          },
        ],
      },
    ]);

    await this.auditLogService.writeAuditLog({
      projectId: project.id,
      resourceType: "project",
      resourceId: project.id,
      action: "create",
      operatorId: input.userId,
      afterPayload: {
        code: project.code,
        name: project.name,
        status: project.status,
        defaultPriceVersionId: project.defaultPriceVersionId ?? null,
        defaultFeeTemplateId: project.defaultFeeTemplateId ?? null,
        stageCodes: stages.map((stage) => stage.stageCode),
        memberUserIds: members.map((member) => member.userId),
      },
    });

    return {
      project,
      stages,
      members,
    };
  }

  async listProjectStages(input: {
    projectId: string;
    userId: string;
    roleCodes: string[];
  }): Promise<ProjectStageRecord[]> {
    await this.getProject(input);
    return this.projectStageRepository.listByProjectId(input.projectId);
  }

  async updateProjectStages(input: {
    projectId: string;
    userId: string;
    roleCodes: string[];
    stages: Array<{
      stageCode: string;
      stageName: string;
      status: ProjectStageRecord["status"];
      sequenceNo: number;
    }>;
  }): Promise<ProjectStageRecord[]> {
    await this.assertCanManageProject(input);
    this.validateStageSetup(input.stages);
    const before = await this.projectStageRepository.listByProjectId(input.projectId);
    const updated = await this.projectStageRepository.replaceByProjectId(
      input.projectId,
      input.stages,
    );

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      resourceType: "project_stage",
      resourceId: input.projectId,
      action: "update",
      operatorId: input.userId,
      beforePayload: {
        stages: before.map((stage) => ({
          stageCode: stage.stageCode,
          stageName: stage.stageName,
          status: stage.status,
          sequenceNo: stage.sequenceNo,
        })),
      },
      afterPayload: {
        stages: updated.map((stage) => ({
          stageCode: stage.stageCode,
          stageName: stage.stageName,
          status: stage.status,
          sequenceNo: stage.sequenceNo,
        })),
      },
    });

    return updated;
  }

  async listProjectDisciplines(
    input: {
      projectId: string;
      userId: string;
      roleCodes: string[];
    },
  ): Promise<ProjectDisciplineRecord[]> {
    await this.getProject(input);
    return this.projectDisciplineRepository.listByProjectId(input.projectId);
  }

  async listProjectMembers(input: {
    projectId: string;
    userId: string;
    roleCodes: string[];
  }): Promise<ProjectMemberRecord[]> {
    await this.getProject(input);
    return this.projectMemberRepository.listByProjectId(input.projectId);
  }

  async updateProjectMembers(input: {
    projectId: string;
    userId: string;
    roleCodes: string[];
    members: Array<Omit<ProjectMemberRecord, "id" | "projectId"> & { id?: string }>;
  }): Promise<ProjectMemberRecord[]> {
    await this.assertCanManageProject(input);
    this.validateProjectMembers(input.members);
    const before = await this.projectMemberRepository.listByProjectId(input.projectId);
    const updated = await this.projectMemberRepository.replaceByProjectId(
      input.projectId,
      input.members,
    );

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      resourceType: "project_member",
      resourceId: input.projectId,
      action: "update",
      operatorId: input.userId,
      beforePayload: {
        members: before.map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          roleCode: member.roleCode,
          scopes: member.scopes,
        })),
      },
      afterPayload: {
        members: updated.map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          roleCode: member.roleCode,
          scopes: member.scopes,
        })),
      },
    });

    return updated;
  }

  async updateProjectPricingDefaults(input: {
    projectId: string;
    userId: string;
    roleCodes: string[];
    defaultPriceVersionId?: string | null;
    defaultFeeTemplateId?: string | null;
  }): Promise<ProjectRecord> {
    await this.assertCanManageProject(input);
    const before = {
      ...(await this.getProject({
        projectId: input.projectId,
        userId: input.userId,
        roleCodes: input.roleCodes,
      })),
    };
    await this.validatePricingDefaults({
      defaultPriceVersionId: input.defaultPriceVersionId,
      defaultFeeTemplateId: input.defaultFeeTemplateId,
    });

    const updatePayload: {
      defaultPriceVersionId?: string | null;
      defaultFeeTemplateId?: string | null;
    } = {};
    if ("defaultPriceVersionId" in input) {
      updatePayload.defaultPriceVersionId = input.defaultPriceVersionId ?? null;
    }
    if ("defaultFeeTemplateId" in input) {
      updatePayload.defaultFeeTemplateId = input.defaultFeeTemplateId ?? null;
    }

    const updated = await this.projectRepository.updateDefaults(
      input.projectId,
      updatePayload,
    );

    await this.auditLogService.writeAuditLog({
      projectId: input.projectId,
      resourceType: "project",
      resourceId: input.projectId,
      action: "update_pricing_defaults",
      operatorId: input.userId,
      beforePayload: {
        defaultPriceVersionId: before.defaultPriceVersionId ?? null,
        defaultFeeTemplateId: before.defaultFeeTemplateId ?? null,
      },
      afterPayload: {
        defaultPriceVersionId: updated.defaultPriceVersionId ?? null,
        defaultFeeTemplateId: updated.defaultFeeTemplateId ?? null,
      },
    });

    return updated;
  }

  private async assertCanManageProject(
    input: {
      projectId: string;
      userId: string;
      roleCodes: string[];
    },
  ): Promise<void> {
    if (input.roleCodes.includes("system_admin")) {
      return;
    }

    await this.ensureProjectExists(input.projectId);
    const authorizationService = new ProjectAuthorizationService({
      stages: await this.projectStageRepository.listByProjectId(input.projectId),
      disciplines: await this.projectDisciplineRepository.listByProjectId(input.projectId),
      members: await this.projectMemberRepository.listByProjectId(input.projectId),
    });

    if (!authorizationService.canManageProject(input)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to manage this project",
      );
    }
  }

  private async assertCanViewProject(input: {
    projectId: string;
    userId: string;
    roleCodes: string[];
  }): Promise<void> {
    if (input.roleCodes.includes("system_admin")) {
      return;
    }

    const authorizationService = new ProjectAuthorizationService({
      stages: await this.projectStageRepository.listByProjectId(input.projectId),
      disciplines: await this.projectDisciplineRepository.listByProjectId(input.projectId),
      members: await this.projectMemberRepository.listByProjectId(input.projectId),
    });

    if (!authorizationService.canViewContext(input)) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "You do not have permission to access this project",
      );
    }
  }

  private async ensureProjectExists(projectId: string): Promise<void> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
    }
  }

  private assertCanCreateProject(userId: string): void {
    if (!userId) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to create projects");
    }
  }

  private validateProjectMembers(
    members: Array<Omit<ProjectMemberRecord, "id" | "projectId"> & { id?: string }>,
  ): void {
    if (members.length === 0) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "At least one project member must be configured",
      );
    }

    const uniqueUserIds = new Set(members.map((member) => member.userId));
    if (uniqueUserIds.size !== members.length) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Duplicate project member users are not allowed",
      );
    }

    if (!members.some((member) => member.roleCode === "project_owner")) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "At least one project owner must be configured",
      );
    }

    for (const member of members) {
      const uniqueScopes = new Set(
        member.scopes.map((scope) => `${scope.scopeType}:${scope.scopeValue}`),
      );
      if (uniqueScopes.size !== member.scopes.length) {
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          `Duplicate scopes are not allowed for user ${member.userId}`,
        );
      }
    }
  }

  private validateStageSetup(
    stages: Array<{
      stageCode: string;
      stageName: string;
      status: ProjectStageRecord["status"];
      sequenceNo: number;
    }>,
  ): void {
    if (stages.length === 0) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "At least one project stage must be configured",
      );
    }

    const uniqueStageCodes = new Set(stages.map((stage) => stage.stageCode));
    if (uniqueStageCodes.size !== stages.length) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Duplicate stage codes are not allowed",
      );
    }

    const uniqueSequences = new Set(stages.map((stage) => stage.sequenceNo));
    if (uniqueSequences.size !== stages.length) {
      throw new AppError(
        422,
        "VALIDATION_ERROR",
        "Duplicate stage sequence numbers are not allowed",
      );
    }
  }

  private async validatePricingDefaults(input: {
    defaultPriceVersionId?: string | null;
    defaultFeeTemplateId?: string | null;
  }): Promise<void> {
    if (input.defaultPriceVersionId) {
      if (!this.priceVersionRepository) {
        throw new AppError(
          500,
          "INTERNAL_ERROR",
          "Price version repository is not configured",
        );
      }
      const priceVersions = await this.priceVersionRepository.list({});
      const exists = priceVersions.some(
        (priceVersion) => priceVersion.id === input.defaultPriceVersionId,
      );
      if (!exists) {
        throw new AppError(
          404,
          "PRICE_VERSION_NOT_FOUND",
          "Price version not found",
        );
      }
    }

    if (input.defaultFeeTemplateId) {
      if (!this.feeTemplateRepository) {
        throw new AppError(
          500,
          "INTERNAL_ERROR",
          "Fee template repository is not configured",
        );
      }
      const feeTemplate = await this.feeTemplateRepository.findById(
        input.defaultFeeTemplateId,
      );
      if (!feeTemplate) {
        throw new AppError(
          404,
          "FEE_TEMPLATE_NOT_FOUND",
          "Fee template not found",
        );
      }
    }
  }

  private async listVisibleBillVersions(input: {
    projectId: string;
    authorizationService: ProjectAuthorizationService;
    roleCodes: string[];
    userId: string;
  }): Promise<BillVersionRecord[]> {
    if (!this.billVersionRepository) {
      return [];
    }

    const versions = await this.billVersionRepository.listByProjectId(input.projectId);
    if (input.roleCodes.includes("system_admin")) {
      return versions;
    }

    return versions.filter((version) =>
      input.authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: version.stageCode,
        disciplineCode: version.disciplineCode,
        userId: input.userId,
      }),
    );
  }

  private pickCurrentStage(
    stages: ProjectStageRecord[],
    requestedStageCode?: string,
  ): ProjectStageRecord | null {
    if (requestedStageCode) {
      const matched = stages.find((stage) => stage.stageCode === requestedStageCode);
      if (matched) {
        return matched;
      }
    }

    return (
      stages.find((stage) => stage.status === "active") ??
      stages[0] ??
      null
    );
  }

  private buildPermissionSummary(input: {
    projectId: string;
    roleCodes: string[];
    stages: ProjectStageRecord[];
    disciplines: ProjectDisciplineRecord[];
    currentMember: ProjectMemberRecord | null;
    authorizationService: ProjectAuthorizationService;
    userId: string;
  }): ProjectWorkspacePermissionSummary {
    if (input.roleCodes.includes("system_admin")) {
      return {
        roleCode: "system_admin",
        roleLabel: "系统管理员",
        canManageProject: true,
        canEditProject: true,
        scopeSummary: ["项目全部范围"],
        visibleStageCodes: input.stages.map((stage) => stage.stageCode),
        visibleDisciplineCodes: input.disciplines.map(
          (discipline) => discipline.disciplineCode,
        ),
      };
    }

    const roleCode = input.currentMember?.roleCode ?? "viewer";
    const visibleStageCodes = this.collectVisibleStageCodes(input);
    const visibleDisciplineCodes = this.collectVisibleDisciplineCodes(input);

    return {
      roleCode,
      roleLabel: this.formatRoleLabel(roleCode),
      canManageProject: input.authorizationService.canManageProject({
        projectId: input.projectId,
        userId: input.userId,
      }),
      canEditProject: this.roleCanEdit(roleCode),
      scopeSummary: this.formatScopeSummary(input.currentMember),
      visibleStageCodes,
      visibleDisciplineCodes,
    };
  }

  private collectVisibleStageCodes(input: {
    stages: ProjectStageRecord[];
    currentMember: ProjectMemberRecord | null;
  }): string[] {
    if (!input.currentMember) {
      return [];
    }

    if (
      input.currentMember.scopes.some(
        (scope) => scope.scopeType === "project" && scope.scopeValue,
      )
    ) {
      return input.stages.map((stage) => stage.stageCode);
    }

    const visibleStageCodes = new Set(
      input.currentMember.scopes
        .filter((scope) => scope.scopeType === "stage")
        .map((scope) => scope.scopeValue),
    );

    return input.stages
      .map((stage) => stage.stageCode)
      .filter((stageCode) => visibleStageCodes.has(stageCode));
  }

  private collectVisibleDisciplineCodes(input: {
    disciplines: ProjectDisciplineRecord[];
    currentMember: ProjectMemberRecord | null;
  }): string[] {
    if (!input.currentMember) {
      return [];
    }

    if (
      input.currentMember.scopes.some(
        (scope) => scope.scopeType === "project" && scope.scopeValue,
      )
    ) {
      return input.disciplines.map((discipline) => discipline.disciplineCode);
    }

    const visibleDisciplineCodes = new Set(
      input.currentMember.scopes
        .filter((scope) => scope.scopeType === "discipline")
        .map((scope) => scope.scopeValue),
    );

    return input.disciplines
      .map((discipline) => discipline.disciplineCode)
      .filter((disciplineCode) => visibleDisciplineCodes.has(disciplineCode));
  }

  private formatScopeSummary(member: ProjectMemberRecord | null): string[] {
    if (!member) {
      return ["未配置项目成员范围"];
    }

    if (
      member.scopes.some(
        (scope) => scope.scopeType === "project" && scope.scopeValue === member.projectId,
      )
    ) {
      return ["项目全部范围"];
    }

    const labels = member.scopes.map((scope) => {
      if (scope.scopeType === "stage") {
        return `阶段：${scope.scopeValue}`;
      }
      if (scope.scopeType === "discipline") {
        return `专业：${scope.scopeValue}`;
      }
      if (scope.scopeType === "unit") {
        return `单元：${scope.scopeValue}`;
      }
      return `项目：${scope.scopeValue}`;
    });

    return labels.length > 0 ? labels : ["未配置项目成员范围"];
  }

  private formatRoleLabel(roleCode: string): string {
    if (roleCode === "project_owner") {
      return "项目负责人";
    }
    if (roleCode === "cost_engineer") {
      return "造价工程师";
    }
    if (roleCode === "reviewer") {
      return "审核人";
    }
    if (roleCode === "system_admin") {
      return "系统管理员";
    }
    return roleCode;
  }

  private roleCanEdit(roleCode: string): boolean {
    return roleCode === "project_owner" || roleCode === "cost_engineer";
  }

  private async buildTodoSummary(input: {
    projectId: string;
    authorizationService: ProjectAuthorizationService;
    userId: string;
  }): Promise<ProjectWorkspaceRecord["todoSummary"]> {
    const [reviews, processDocuments] = await Promise.all([
      this.listVisibleReviewSubmissions(input),
      this.listVisibleProcessDocuments(input),
    ]);
    const pendingReviewCount = reviews.filter(
      (review) => review.status === "pending",
    ).length;
    const pendingProcessDocumentCount = processDocuments.filter(
      (document) => document.status === "submitted",
    ).length;
    const draftProcessDocumentCount = processDocuments.filter(
      (document) => document.status === "draft",
    ).length;
    const items: string[] = [];

    if (pendingReviewCount > 0) {
      items.push(`${pendingReviewCount} 条审核待处理`);
    }
    if (pendingProcessDocumentCount > 0) {
      items.push(`${pendingProcessDocumentCount} 条过程单据待审核`);
    }
    if (draftProcessDocumentCount > 0) {
      items.push(`${draftProcessDocumentCount} 条过程单据仍在草稿`);
    }
    if (items.length === 0) {
      items.push("当前没有待处理事项");
    }

    return {
      totalCount:
        pendingReviewCount +
        pendingProcessDocumentCount +
        draftProcessDocumentCount,
      pendingReviewCount,
      pendingProcessDocumentCount,
      draftProcessDocumentCount,
      items,
    };
  }

  private async buildRiskSummary(input: {
    projectId: string;
    authorizationService: ProjectAuthorizationService;
    userId: string;
  }): Promise<ProjectWorkspaceRecord["riskSummary"]> {
    const [reviews, processDocuments, jobs] = await Promise.all([
      this.listVisibleReviewSubmissions(input),
      this.listVisibleProcessDocuments(input),
      this.backgroundJobRepository?.list({ projectId: input.projectId }) ?? [],
    ]);
    const rejectedReviewCount = reviews.filter(
      (review) => review.status === "rejected",
    ).length;
    const rejectedProcessDocumentCount = processDocuments.filter(
      (document) => document.status === "rejected",
    ).length;
    const failedJobCount = jobs.filter((job) => job.status === "failed").length;
    const items: string[] = [];

    if (rejectedReviewCount > 0) {
      items.push(`${rejectedReviewCount} 条审核被驳回`);
    }
    if (rejectedProcessDocumentCount > 0) {
      items.push(`${rejectedProcessDocumentCount} 条过程单据被退回`);
    }
    if (failedJobCount > 0) {
      items.push(`${failedJobCount} 个异步任务失败`);
    }
    if (items.length === 0) {
      items.push("当前没有显式风险项");
    }

    return {
      totalCount: rejectedReviewCount + rejectedProcessDocumentCount + failedJobCount,
      rejectedReviewCount,
      rejectedProcessDocumentCount,
      failedJobCount,
      items,
    };
  }

  private async buildImportStatus(
    projectId: string,
  ): Promise<ProjectWorkspaceRecord["importStatus"]> {
    const tasks = await (this.importTaskRepository?.listByProjectId(projectId) ?? []);
    const queuedCount = tasks.filter((task) => task.status === "queued").length;
    const processingCount = tasks.filter(
      (task) => task.status === "processing",
    ).length;
    const completedCount = tasks.filter(
      (task) => task.status === "completed",
    ).length;
    const failedCount = tasks.filter((task) => task.status === "failed").length;
    const latestTask = tasks[0]
      ? {
          id: tasks[0].id,
          sourceType: tasks[0].sourceType,
          sourceLabel: tasks[0].sourceLabel,
          status: tasks[0].status,
          createdAt: tasks[0].createdAt,
        }
      : null;

    return {
      mode: "import_task",
      totalCount: tasks.length,
      queuedCount,
      processingCount,
      completedCount,
      failedCount,
      latestTask,
      note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
    };
  }

  private async listVisibleReviewSubmissions(input: {
    projectId: string;
    authorizationService: ProjectAuthorizationService;
    userId: string;
  }): Promise<ReviewSubmissionRecord[]> {
    if (!this.reviewSubmissionRepository) {
      return [];
    }

    const items = await this.reviewSubmissionRepository.listByProjectId(input.projectId);
    return items.filter((item) =>
      input.authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: item.stageCode,
        disciplineCode: item.disciplineCode,
        userId: input.userId,
      }),
    );
  }

  private async listVisibleProcessDocuments(input: {
    projectId: string;
    authorizationService: ProjectAuthorizationService;
    userId: string;
  }): Promise<ProcessDocumentRecord[]> {
    if (!this.processDocumentRepository) {
      return [];
    }

    const items = await this.processDocumentRepository.listByProjectId(input.projectId);
    return items.filter((item) =>
      input.authorizationService.canViewContext({
        projectId: input.projectId,
        stageCode: item.stageCode,
        disciplineCode: item.disciplineCode,
        userId: input.userId,
      }),
    );
  }
}
