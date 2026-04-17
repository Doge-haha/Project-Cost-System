import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/app/create-app.js";
import { signAccessToken } from "../src/shared/auth/jwt.js";
import {
  InMemoryFeeRuleRepository,
  type FeeRuleRecord,
} from "../src/modules/fee/fee-rule-repository.js";
import {
  InMemoryFeeTemplateRepository,
  type FeeTemplateRecord,
} from "../src/modules/fee/fee-template-repository.js";

const jwtSecret = "fee-template-test-secret";

const feeTemplates: FeeTemplateRecord[] = [
  {
    id: "fee-template-001",
    templateName: "江苏建筑默认取费",
    projectType: "building",
    regionCode: "JS",
    stageScope: ["estimate", "bid"],
    taxMode: "general",
    allocationMode: "proportional",
    status: "active",
  },
  {
    id: "fee-template-002",
    templateName: "浙江安装默认取费",
    projectType: "installation",
    regionCode: "ZJ",
    stageScope: ["construction"],
    taxMode: "general",
    allocationMode: "proportional",
    status: "inactive",
  },
];

const feeRules: FeeRuleRecord[] = [
  {
    id: "fee-rule-001",
    feeTemplateId: "fee-template-001",
    disciplineCode: "building",
    feeType: "management_fee",
    feeRate: 0.08,
  },
  {
    id: "fee-rule-002",
    feeTemplateId: "fee-template-001",
    disciplineCode: null,
    feeType: "tax",
    feeRate: 0.03,
  },
];

function createFeeTemplateApp() {
  return createApp({
    jwtSecret,
    feeTemplateRepository: new InMemoryFeeTemplateRepository(feeTemplates),
    feeRuleRepository: new InMemoryFeeRuleRepository(feeRules),
  });
}

test("GET /v1/fee-templates filters by region and stage", async () => {
  const app = createFeeTemplateApp();
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/fee-templates?regionCode=JS&stageCode=estimate&status=active",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    items: [feeTemplates[0]],
  });

  await app.close();
});

test("GET /v1/fee-templates/:id returns template details with rules", async () => {
  const app = createFeeTemplateApp();
  const token = await signAccessToken(
    {
      sub: "user-001",
      roleCodes: ["project_owner"],
      displayName: "Owner User",
    },
    jwtSecret,
  );

  const response = await app.inject({
    method: "GET",
    url: "/v1/fee-templates/fee-template-001",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ...feeTemplates[0],
    rules: feeRules,
  });

  await app.close();
});
