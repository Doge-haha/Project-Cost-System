import test from "node:test";
import assert from "node:assert/strict";

import {
  InMemoryBillVersionRepository,
  type BillVersionRecord,
} from "../../api/src/modules/bill/bill-version-repository.js";
import { InMemoryBackgroundJobRepository } from "../../api/src/modules/jobs/background-job-repository.js";
import { InMemoryFeeTemplateRepository } from "../../api/src/modules/fee/fee-template-repository.js";
import { InMemoryPriceVersionRepository } from "../../api/src/modules/pricing/price-version-repository.js";
import { createGatewayTestApp } from "./helpers/http-gateway-harness.js";
import {
  createGatewayTestApiApp,
  createGatewayTestToken,
} from "./helpers/project-seeds.js";

const seededBillVersions: BillVersionRecord[] = [
  {
    id: "bill-version-001",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    versionNo: 1,
    versionName: "估算版 V1",
    versionStatus: "editable",
    sourceVersionId: null,
  },
];

test("recalculate-project tool and job-status resource stay aligned over HTTP", async () => {
  const apiApp = createGatewayTestApiApp({
    appOptions: {
      billVersionRepository: new InMemoryBillVersionRepository(seededBillVersions),
      backgroundJobRepository: new InMemoryBackgroundJobRepository([]),
      priceVersionRepository: new InMemoryPriceVersionRepository([
        {
          id: "price-version-001",
          versionCode: "JS-2026",
          versionName: "江苏 2026",
          regionCode: "320000",
          disciplineCode: "building",
          status: "active",
        },
      ]),
      feeTemplateRepository: new InMemoryFeeTemplateRepository([
        {
          id: "fee-template-001",
          templateName: "估算取费模板",
          projectType: null,
          regionCode: null,
          stageScope: ["estimate"],
          taxMode: "general",
          allocationMode: "by_discipline",
          status: "active",
        },
      ]),
    },
  });
  const gatewayApp = createGatewayTestApp(apiApp);
  const token = await createGatewayTestToken();

  try {
    const recalculateResponse = await gatewayApp.inject({
      method: "POST",
      url: "/v1/tools/recalculate-project",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        projectId: "project-001",
        stageCode: "estimate",
        disciplineCode: "building",
        priceVersionId: "price-version-001",
        feeTemplateId: "fee-template-001",
      },
    });

    assert.equal(recalculateResponse.statusCode, 200);
    assert.equal(recalculateResponse.json().type, "tool_result");
    assert.equal(recalculateResponse.json().tool, "recalculate_project");
    assert.equal(recalculateResponse.json().result.jobType, "project_recalculate");
    assert.equal(recalculateResponse.json().result.status, "queued");
    assert.equal(
      recalculateResponse.json().execution.jobId,
      recalculateResponse.json().result.id,
    );

    const statusResponse = await gatewayApp.inject({
      method: "GET",
      url: `/v1/resources/job-status?jobId=${recalculateResponse.json().result.id}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(statusResponse.statusCode, 200);
    assert.equal(statusResponse.json().type, "resource");
    assert.equal(statusResponse.json().resourceType, "job_status");
    assert.equal(statusResponse.json().data.id, recalculateResponse.json().result.id);
    assert.equal(statusResponse.json().data.jobType, "project_recalculate");
    assert.equal(statusResponse.json().data.status, "queued");
    assert.equal(statusResponse.json().data.payload.projectId, "project-001");
    assert.equal(statusResponse.json().data.payload.stageCode, "estimate");
    assert.equal(statusResponse.json().data.payload.disciplineCode, "building");
  } finally {
    await gatewayApp.close();
    await apiApp.close();
  }
});
