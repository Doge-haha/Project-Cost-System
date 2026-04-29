export const projectStatuses = [
  "draft",
  "in_progress",
  "under_review",
  "archived",
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const projectStageStatuses = [
  "not_started",
  "in_progress",
  "pending_review",
  "approved",
  "completed",
  "skipped",
] as const;

export type ProjectStageStatus = (typeof projectStageStatuses)[number];

export const platformRoleCodes = [
  "system_admin",
  "project_owner",
  "cost_engineer",
  "reviewer",
] as const;

export type PlatformRoleCode = (typeof platformRoleCodes)[number];

export const businessIdentityCodes = [
  "tender_cost_engineer",
  "bid_cost_engineer",
  "audit_reviewer",
] as const;

export type BusinessIdentityCode = (typeof businessIdentityCodes)[number];

export const projectResourceTypes = [
  "project",
  "stage",
  "project_discipline",
  "standard_set",
] as const;

export type ProjectResourceType = (typeof projectResourceTypes)[number];

export const projectPermissionActions = [
  "view",
  "edit",
  "submit",
  "review",
  "import",
] as const;

export type ProjectPermissionAction = (typeof projectPermissionActions)[number];

export const standardProjectStageTemplates = [
  {
    stageCode: "estimate",
    stageName: "投资估算",
    sequenceNo: 1,
  },
  {
    stageCode: "target_cost",
    stageName: "目标成本",
    sequenceNo: 2,
  },
  {
    stageCode: "bid_bill",
    stageName: "招标清单",
    sequenceNo: 3,
  },
  {
    stageCode: "control_price",
    stageName: "招标控制价",
    sequenceNo: 4,
  },
  {
    stageCode: "bid_quote",
    stageName: "投标报价",
    sequenceNo: 5,
  },
  {
    stageCode: "contract_bill",
    stageName: "合同清单",
    sequenceNo: 6,
  },
  {
    stageCode: "construction",
    stageName: "施工过程",
    sequenceNo: 7,
  },
  {
    stageCode: "settlement",
    stageName: "竣工结算",
    sequenceNo: 8,
  },
  {
    stageCode: "retrospective",
    stageName: "项目复盘",
    sequenceNo: 9,
  },
] as const;
