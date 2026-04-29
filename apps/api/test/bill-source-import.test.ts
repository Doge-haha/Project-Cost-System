import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/app/create-app.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import {
  InMemoryAuditLogRepository,
  type AuditLogRecord,
} from "../src/modules/audit/audit-log-repository.js";
import {
  InMemoryBillItemRepository,
  type BillItemRecord,
} from "../src/modules/bill/bill-item-repository.js";
import {
  InMemoryBillVersionRepository,
  type BillVersionRecord,
} from "../src/modules/bill/bill-version-repository.js";
import {
  InMemoryBillWorkItemRepository,
  type BillWorkItemRecord,
} from "../src/modules/bill/bill-work-item-repository.js";
import {
  InMemoryImportTaskRepository,
  type ImportTaskRecord,
} from "../src/modules/import/import-task-repository.js";
import {
  InMemoryProjectDisciplineRepository,
  type ProjectDisciplineRecord,
} from "../src/modules/project/project-discipline-repository.js";
import {
  InMemoryProjectMemberRepository,
  type ProjectMemberRecord,
} from "../src/modules/project/project-member-repository.js";
import {
  InMemoryProjectRepository,
  type ProjectRecord,
} from "../src/modules/project/project-repository.js";
import {
  InMemoryProjectStageRepository,
  type ProjectStageRecord,
} from "../src/modules/project/project-stage-repository.js";

const jwtSecret = "bill-source-import-test-secret";

const projects: ProjectRecord[] = [
  {
    id: "project-001",
    code: "PRJ-001",
    name: "源数据导入项目",
    status: "draft",
  },
];

const stages: ProjectStageRecord[] = [
  {
    id: "stage-001",
    projectId: "project-001",
    stageCode: "bid_bill",
    stageName: "招标清单",
    status: "not_started",
    sequenceNo: 1,
  },
  {
    id: "stage-002",
    projectId: "project-001",
    stageCode: "budget",
    stageName: "施工图预算",
    status: "not_started",
    sequenceNo: 2,
  },
];

const disciplines: ProjectDisciplineRecord[] = [
  {
    id: "discipline-001",
    projectId: "project-001",
    disciplineCode: "building",
    disciplineName: "建筑工程",
    defaultStandardSetCode: "js-2013-building",
    status: "enabled",
  },
  {
    id: "discipline-002",
    projectId: "project-001",
    disciplineCode: "install",
    disciplineName: "安装工程",
    defaultStandardSetCode: "js-2013-install",
    status: "enabled",
  },
];

const members: ProjectMemberRecord[] = [
  {
    id: "member-001",
    projectId: "project-001",
    userId: "owner-001",
    displayName: "Owner User",
    roleCode: "project_owner",
    scopes: [{ scopeType: "project", scopeValue: "project-001" }],
  },
  {
    id: "member-002",
    projectId: "project-001",
    userId: "reviewer-001",
    displayName: "Reviewer User",
    roleCode: "reviewer",
    scopes: [
      { scopeType: "stage", scopeValue: "bid_bill" },
      { scopeType: "discipline", scopeValue: "building" },
    ],
  },
  {
    id: "member-003",
    projectId: "project-001",
    userId: "engineer-001",
    displayName: "Engineer User",
    roleCode: "cost_engineer",
    scopes: [
      { scopeType: "stage", scopeValue: "bid_bill" },
      { scopeType: "discipline", scopeValue: "building" },
    ],
  },
];

function createBillSourceImportApp(seed?: {
  billVersions?: BillVersionRecord[];
  billItems?: BillItemRecord[];
  billWorkItems?: BillWorkItemRecord[];
  importTasks?: ImportTaskRecord[];
  auditLogs?: AuditLogRecord[];
}) {
  return createApp({
    jwtSecret,
    projectRepository: new InMemoryProjectRepository(projects),
    projectStageRepository: new InMemoryProjectStageRepository(stages),
    projectDisciplineRepository: new InMemoryProjectDisciplineRepository(disciplines),
    projectMemberRepository: new InMemoryProjectMemberRepository(members),
    billVersionRepository: new InMemoryBillVersionRepository(seed?.billVersions ?? []),
    billItemRepository: new InMemoryBillItemRepository(seed?.billItems ?? []),
    billWorkItemRepository: new InMemoryBillWorkItemRepository(seed?.billWorkItems ?? []),
    importTaskRepository: new InMemoryImportTaskRepository(seed?.importTasks ?? []),
    auditLogRepository: new InMemoryAuditLogRepository(seed?.auditLogs ?? []),
  });
}

async function auth(userId: string, roleCodes: string[]) {
  return {
    authorization: `Bearer ${await signAccessToken(
      {
        sub: userId,
        displayName: userId,
        roleCodes,
      },
      jwtSecret,
    )}`,
  };
}

test("imports source bill tables into a version, items, work contents, task summary and audit", async () => {
  const app = createBillSourceImportApp();

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-imports/source",
    headers: await auth("owner-001", ["project_owner"]),
    payload: {
      stageCode: "bid_bill",
      disciplineCode: "building",
      versionName: "招标清单导入版",
      sourceBatchNo: "batch-001",
      sourceTables: {
        ZaoJia_Qd_QdList: [
          {
            QdID: "qd-001",
            QdGf: "GB50500-2013",
            Qdmc: "建筑工程工程量清单",
          },
        ],
        ZaoJia_Qd_Qdxm: [
          {
            QdID: "item-001",
            ParentQdID: null,
            Sjxh: 1,
            Qdbh: "010101001001",
            Xmmc: "平整场地",
            Dw: "m2",
            Gcl: 120,
            Jsgz: "按设计图示尺寸以面积计算",
          },
        ],
        ZaoJia_Qd_Gznr: [
          {
            QdID: "item-001",
            Gznr: "场地清理、平整、运输",
          },
        ],
      },
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.summary.versionCount, 1);
  assert.equal(body.summary.billItemCount, 1);
  assert.equal(body.summary.workItemCount, 1);
  assert.equal(body.summary.failedItemCount, 0);
  assert.equal(body.importTask.status, "completed");
  assert.equal(body.billVersion.sourceSpecCode, "GB50500-2013");
  assert.equal(body.billVersion.sourceSpecName, "建筑工程工程量清单");

  const itemsResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/bill-versions/${body.billVersion.id}/items`,
    headers: await auth("owner-001", ["project_owner"]),
  });
  assert.equal(itemsResponse.statusCode, 200);
  const item = itemsResponse.json().items[0];
  assert.equal(item.itemCode, "010101001001");
  assert.equal(item.itemName, "平整场地");
  assert.equal(item.quantity, 120);
  assert.equal(item.unit, "m2");
  assert.equal(item.sourceBillId, "item-001");
  assert.equal(item.sourceSequence, 1);
  assert.equal(item.featureRuleText, "计算规则：按设计图示尺寸以面积计算");

  const workItemsResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/bill-versions/${body.billVersion.id}/items/${item.id}/work-items`,
    headers: await auth("owner-001", ["project_owner"]),
  });
  assert.equal(workItemsResponse.statusCode, 200);
  assert.equal(workItemsResponse.json().items[0].workContent, "场地清理、平整、运输");

  const tasksResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/import-tasks",
    headers: await auth("owner-001", ["project_owner"]),
  });
  assert.equal(tasksResponse.statusCode, 200);
  assert.equal(tasksResponse.json().items[0].sourceType, "source_bill");

  const auditResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/audit-logs?resourceType=import_task",
    headers: await auth("owner-001", ["project_owner"]),
  });
  assert.equal(auditResponse.statusCode, 200);
  assert.ok(
    auditResponse
      .json()
      .items.some((item: { action: string }) => item.action === "bill_import"),
  );
});

test("keeps source import failure details when rows cannot be mapped", async () => {
  const app = createBillSourceImportApp();

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-imports/source",
    headers: await auth("owner-001", ["project_owner"]),
    payload: {
      stageCode: "bid_bill",
      disciplineCode: "building",
      sourceTables: {
        ZaoJia_Qd_QdList: [
          {
            QdID: "qd-001",
            Qdmc: "缺字段清单",
          },
        ],
        ZaoJia_Qd_Qdxm: [
          {
            QdID: "broken-item",
            Xmmc: "缺少编码",
            Dw: "m2",
          },
        ],
        ZaoJia_Qd_Gznr: [
          {
            QdID: "missing-item",
            Gznr: "无法挂接",
          },
        ],
      },
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.importTask.status, "failed");
  assert.equal(body.summary.failedItemCount, 2);
  assert.match(body.importTask.failureDetails.join("\n"), /Qdbh/);
  assert.match(body.importTask.failureDetails.join("\n"), /missing-item/);
  assert.equal(body.failedItems[0].reasonCode, "missing_field");
  assert.equal(body.importTask.metadata.failureSummary[0].reasonCode, "missing_field");
});

test("previews parsed source bill before creating versions or items", async () => {
  const app = createBillSourceImportApp();

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-imports/source/preview",
    headers: await auth("owner-001", ["project_owner"]),
    payload: {
      stageCode: "bid_bill",
      disciplineCode: "building",
      sourceTables: {
        ZaoJia_Qd_QdList: [{ QdID: "list-v1", Qdmc: "预览版" }],
        ZaoJia_Qd_Qdxm: [
          { QdID: "item-1", Qdbh: "010101001001", Xmmc: "平整场地", Dw: "m2" },
          { QdID: "item-2", Qdbh: "010101001001", Xmmc: "重复编码", Dw: "m2" },
        ],
        ZaoJia_Qd_Gznr: [{ QdID: "item-1", Gznr: "清理" }],
      },
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.summary.versionCount, 1);
  assert.equal(body.summary.billItemCount, 2);
  assert.equal(body.summary.workItemCount, 1);
  assert.equal(body.summary.failedItemCount, 1);
  assert.equal(body.failedItems[0].reasonCode, "duplicate_code");

  const tasksResponse = await app.inject({
    method: "GET",
    url: "/v1/projects/project-001/import-tasks",
    headers: await auth("owner-001", ["project_owner"]),
  });
  assert.equal(tasksResponse.statusCode, 200);
  assert.equal(tasksResponse.json().items.length, 0);
});

test("imports parsed source bill file with aliases, parent tree, duplicate reports and empty quantity", async () => {
  const app = createBillSourceImportApp();

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-imports/source",
    headers: await auth("owner-001", ["project_owner"]),
    payload: {
      stageCode: "bid_bill",
      disciplineCode: "building",
      sourceFileName: "source-bill.json",
      sourceFileContent: JSON.stringify({
        sourceTables: {
          qdList: [
            {
              qdId: "list-v1",
              qdGf: "GB50500-2013",
              qdMc: "导入版 A",
            },
            {
              qdId: "list-v2",
              qdGf: "GB50500-2018",
              qdMc: "导入版 B",
              visible: false,
              defaultFlag: true,
            },
          ],
          qdxm: [
            {
              id: "root-001",
              orderNo: 1,
              code: "010101001001",
              name: "土方工程",
              unitName: "m3",
              quantity: "",
            },
            {
              id: "child-001",
              parentId: "root-001",
              orderNo: 2,
              code: "010101001001",
              name: "土方子项",
              unitName: "m3",
              quantity: "0",
              measureFlag: "是",
              feeId: "fee-001",
              measureCategory: "单价措施",
              featureText: "三类土",
              calculationRule: "按体积计算",
              quotaCode: "1-1",
            },
          ],
          gznr: [
            {
              billId: "child-001",
              content: "挖土、装土",
            },
          ],
        },
      }),
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.equal(body.summary.versionCount, 2);
  assert.equal(body.summary.billItemCount, 2);
  assert.equal(body.summary.workItemCount, 1);
  assert.equal(body.summary.failedItemCount, 1);
  assert.equal(body.summary.measureItemCount, 1);
  assert.equal(body.summary.feeItemCount, 1);
  assert.equal(body.summary.featureItemCount, 1);
  assert.equal(body.summary.quotaClueCount, 1);
  assert.equal(body.failedItems[0].reasonCode, "duplicate_code");
  assert.equal(body.importTask.metadata.failureSummary[0].reasonCode, "duplicate_code");
  assert.equal(body.importTask.sourceFileName, "source-bill.json");
  assert.equal(body.importTask.sourceBatchNo, "list-v1");
  assert.equal(body.billVersion.sourceSpecCode, "GB50500-2013");

  const itemsResponse = await app.inject({
    method: "GET",
    url: `/v1/projects/project-001/bill-versions/${body.billVersion.id}/items`,
    headers: await auth("owner-001", ["project_owner"]),
  });
  assert.equal(itemsResponse.statusCode, 200);
  const items = itemsResponse.json().items;
  assert.equal(items[0].quantity, 0);
  assert.equal(items[1].quantity, 0);
  assert.equal(items[1].parentId, items[0].id);
  assert.equal(items[1].itemCode, "010101001001");
  assert.equal(items[1].isMeasureItem, true);
  assert.equal(items[1].sourceFeeId, "fee-001");
  assert.equal(items[1].measureCategory, "单价措施");
  assert.match(items[1].featureRuleText, /清单特征：三类土/);
  assert.match(items[1].featureRuleText, /计算规则：按体积计算/);
  assert.match(items[1].featureRuleText, /定额关联线索：1-1/);
});

test("rejects source bill import outside editable stage or discipline scope", async () => {
  const app = createBillSourceImportApp();

  const acrossStage = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-imports/source",
    headers: await auth("engineer-001", ["cost_engineer"]),
    payload: {
      stageCode: "budget",
      disciplineCode: "building",
      sourceTables: {
        ZaoJia_Qd_QdList: [],
        ZaoJia_Qd_Qdxm: [],
        ZaoJia_Qd_Gznr: [],
      },
    },
  });
  assert.equal(acrossStage.statusCode, 403);

  const acrossDiscipline = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-imports/source",
    headers: await auth("engineer-001", ["cost_engineer"]),
    payload: {
      stageCode: "bid_bill",
      disciplineCode: "install",
      sourceTables: {
        ZaoJia_Qd_QdList: [],
        ZaoJia_Qd_Qdxm: [],
        ZaoJia_Qd_Gznr: [],
      },
    },
  });
  assert.equal(acrossDiscipline.statusCode, 403);
});

test("requires bill import permission", async () => {
  const app = createBillSourceImportApp();

  const response = await app.inject({
    method: "POST",
    url: "/v1/projects/project-001/bill-imports/source",
    headers: await auth("reviewer-001", ["reviewer"]),
    payload: {
      stageCode: "bid_bill",
      disciplineCode: "building",
      sourceTables: {
        ZaoJia_Qd_QdList: [],
        ZaoJia_Qd_Qdxm: [],
        ZaoJia_Qd_Gznr: [],
      },
    },
  });

  assert.equal(response.statusCode, 403);
});
