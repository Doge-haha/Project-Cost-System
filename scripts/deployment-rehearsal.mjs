import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

import { SignJWT } from "jose";
import pg from "pg";

const cliArgs = new Set(process.argv.slice(2));
const trialMode = cliArgs.has("--trial") || process.env.TRIAL_REHEARSAL === "1";
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/saas_pricing";
const jwtSecret = process.env.JWT_SECRET ?? "deployment-rehearsal-secret";
const requireLlmProvider =
  cliArgs.has("--require-llm-provider") || process.env.REQUIRE_LLM_PROVIDER === "1";
const rootEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  JWT_SECRET: jwtSecret,
};

const processes = [];
const report = {
  startedAt: new Date().toISOString(),
  checks: [],
};

async function main() {
  assertRehearsalConfig();
  await run("docker dependencies", "npm", ["run", "dev:deps:up"], rootEnv);
  await run(
    "database migrations",
    "npm",
    ["--workspace", "@saas-pricing/api", "run", "db:migrate"],
    rootEnv,
  );

  const apiPort = await getAvailablePort(3300);
  const gatewayPort = await getAvailablePort(apiPort + 1);
  const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
  const gatewayBaseUrl = `http://127.0.0.1:${gatewayPort}`;
  const ownerToken = await signToken({
    sub: "trial-owner-001",
    displayName: "Trial Owner",
    roleCodes: ["project_owner"],
  });
  const systemToken = await signToken({
    sub: "trial-system-admin",
    displayName: "Trial System Admin",
    roleCodes: ["system_admin"],
  });

  startProcess("api", "./node_modules/.bin/tsx", ["apps/api/src/server.ts"], {
    ...rootEnv,
    APP_STORAGE_MODE: "database",
    API_HOST: "127.0.0.1",
    API_PORT: String(apiPort),
  });
  await waitForJson(`${apiBaseUrl}/health`);
  record("api health", { url: `${apiBaseUrl}/health` });

  const projectCode = `TRIAL-${Date.now().toString(36).toUpperCase()}`;
  const projectPayload = {
    code: projectCode,
    name: "部署演练试运行项目",
    stages: [
      {
        stageCode: "estimate",
        stageName: "投资估算",
        status: "draft",
        sequenceNo: 1,
      },
      {
        stageCode: "budget",
        stageName: "施工图预算",
        status: "draft",
        sequenceNo: 2,
      },
    ],
  };
  const createdProject = await requestJson(`${apiBaseUrl}/v1/projects`, {
    method: "POST",
    token: ownerToken,
    body: projectPayload,
    expectedStatus: 201,
  });
  const projectId = createdProject.project.id;
  const trialPricing = await seedTrialProjectReferenceData(projectId);
  record("project create", { projectId, code: projectCode });

  await requestJson(`${apiBaseUrl}/v1/projects/${projectId}/workspace`, {
    token: ownerToken,
  });
  await requestJson(`${apiBaseUrl}/v1/projects/${projectId}/stages`, {
    token: ownerToken,
  });
  record("project workspace", { projectId });

  const billVersion = await requestJson(
    `${apiBaseUrl}/v1/projects/${projectId}/bill-versions`,
    {
      method: "POST",
      token: ownerToken,
      body: {
        stageCode: "estimate",
        disciplineCode: "building",
        versionName: "部署演练估算版",
      },
      expectedStatus: 201,
    },
  );
  const billVersionId = billVersion.id;
  const billItem = await requestJson(
    `${apiBaseUrl}/v1/projects/${projectId}/bill-versions/${billVersionId}/items`,
    {
      method: "POST",
      token: ownerToken,
      body: {
        parentId: null,
        itemCode: "A-001",
        itemName: "土方工程",
        quantity: 10,
        unit: "m3",
        sortNo: 1,
      },
      expectedStatus: 201,
    },
  );
  await requestJson(
    `${apiBaseUrl}/v1/projects/${projectId}/bill-versions/${billVersionId}/items/${billItem.id}/work-items`,
    {
      method: "POST",
      token: ownerToken,
      body: {
        workContent: "土方开挖、场内倒运、基底清理",
        sortNo: 1,
      },
      expectedStatus: 201,
    },
  );
  await requestJson(`${apiBaseUrl}/v1/projects/${projectId}/quota-lines/batch-create`, {
    method: "POST",
    token: ownerToken,
    body: {
      items: [
        {
          billVersionId,
          billItemId: billItem.id,
          sourceStandardSetCode: "JS-2014",
          sourceQuotaId: "trial-quota-010101",
          sourceSequence: 1,
          chapterCode: "01",
          quotaCode: "010101",
          quotaName: "挖土方",
          unit: "m3",
          quantity: 10,
          laborFee: 1,
          materialFee: 2,
          machineFee: 3,
          contentFactor: 1,
          sourceMode: "manual",
        },
      ],
    },
    expectedStatus: 201,
  });
  const recalculation = await requestJson(
    `${apiBaseUrl}/v1/projects/${projectId}/bill-versions/${billVersionId}/recalculate`,
    {
      method: "POST",
      token: ownerToken,
      body: {
        priceVersionId: trialPricing.priceVersionId,
        feeTemplateId: trialPricing.feeTemplateId,
      },
    },
  );
  if (recalculation.recalculatedCount < 1) {
    throw new Error("Business sample recalculation did not price any bill item");
  }
  record("business sample bill setup", {
    projectId,
    billVersionId,
    billItemId: billItem.id,
    recalculatedCount: recalculation.recalculatedCount,
  });

  const providerHealth = await requestJson(`${apiBaseUrl}/v1/ai/provider-health`, {
    token: ownerToken,
  });
  const providerHealthStatus = {
    configured: Boolean(providerHealth.configured),
    healthy: Boolean(providerHealth.healthy),
    provider: providerHealth.provider ?? null,
    model: providerHealth.model ?? null,
    message: providerHealth.message ?? null,
    required: requireLlmProvider,
  };
  record("provider health", providerHealthStatus);
  if (
    requireLlmProvider &&
    (!providerHealthStatus.configured || !providerHealthStatus.healthy)
  ) {
    throw new Error(
      [
        "LLM Provider rehearsal is required but /v1/ai/provider-health is not healthy.",
        "Configure LLM_API_KEY, LLM_MODEL, and LLM_BASE_URL, then rerun npm run deploy:provider-rehearsal.",
        `Provider health: ${JSON.stringify(providerHealthStatus)}`,
      ].join(" "),
    );
  }

  const recommendation = await requestJson(`${apiBaseUrl}/v1/ai/bill-recommendations`, {
    method: "POST",
    token: ownerToken,
    body: {
      projectId,
      stageCode: "estimate",
      disciplineCode: "building",
      resourceType: "bill_version",
      resourceId: billVersionId,
      inputPayload: {
        source: "deployment_rehearsal_business_sample",
      },
      outputPayload: {
        parentId: null,
        itemCode: "A-002",
        itemName: "回填土",
        quantity: 6,
        unit: "m3",
        sortNo: 2,
        reason: "部署演练样本补齐常见缺项",
      },
    },
    expectedStatus: 201,
  });
  const acceptedRecommendation = await requestJson(
    `${apiBaseUrl}/v1/ai/recommendations/${recommendation.id}/accept`,
    {
      method: "POST",
      token: ownerToken,
      body: {
        reason: "部署演练确认接受",
      },
    },
  );
  const billItems = await requestJson(
    `${apiBaseUrl}/v1/projects/${projectId}/bill-versions/${billVersionId}/items`,
    {
      token: ownerToken,
    },
  );
  if (billItems.items.length < 2 || acceptedRecommendation.status !== "accepted") {
    throw new Error("AI recommendation accept did not create the sample bill item");
  }
  record("business sample ai recommendation accepted", {
    projectId,
    billVersionId,
    recommendationId: recommendation.id,
    acceptedBillItemId: acceptedRecommendation.outputPayload.acceptedBillItemId,
  });

  const exportResponse = await requestJson(`${apiBaseUrl}/v1/reports/export`, {
    method: "POST",
    token: ownerToken,
    body: {
      projectId,
      reportType: "summary",
      stageCode: "estimate",
    },
    expectedStatus: 202,
  });
  record("report export queued", {
    projectId,
    jobId: exportResponse.job.id,
    taskId: exportResponse.result.id,
  });

  await run(
    "worker one-shot",
    "npm",
    ["--workspace", "@saas-pricing/worker", "run", "start"],
    {
      ...rootEnv,
      API_BASE_URL: apiBaseUrl,
      WORKER_TOKEN: systemToken,
      POLL_INTERVAL_MS: "100",
      MAX_ITERATIONS: "5",
      AI_RUNTIME_CLI_PATH: `${process.cwd()}/apps/ai-runtime/app/cli.py`,
    },
  );
  const jobs = await requestJson(`${apiBaseUrl}/v1/jobs?projectId=${projectId}`, {
    token: ownerToken,
  });
  const processedJob = jobs.items.find((job) => job.id === exportResponse.job.id);
  if (!processedJob || processedJob.status !== "completed") {
    throw new Error(`Worker did not complete report export job ${exportResponse.job.id}`);
  }
  record("worker processed job", {
    jobId: processedJob.id,
    status: processedJob.status,
  });

  const importUpload = await requestJson(
    `${apiBaseUrl}/v1/projects/${projectId}/import-tasks/upload`,
    {
      method: "POST",
      token: ownerToken,
      body: {
        fileName: "deployment-rehearsal-source-bill.json",
        sourceType: "source_bill",
        sourceLabel: "部署演练源清单样本",
        fileContent: JSON.stringify(
          buildSourceBillImportEvents({
            projectId,
            billVersionId,
            billItemId: billItem.id,
          }),
        ),
      },
      expectedStatus: 202,
    },
  );
  if (importUpload.acceptedEventCount !== 3 || importUpload.eventCount !== 3) {
    throw new Error("Business sample source-bill import did not accept all sample events");
  }
  if (importUpload.task.sourceType !== "source_bill") {
    throw new Error("Business sample import task did not preserve source_bill type");
  }
  record("business sample import upload", {
    projectId,
    taskId: importUpload.task.id,
    jobId: importUpload.job.id,
    sourceType: importUpload.task.sourceType,
    acceptedEventCount: importUpload.acceptedEventCount,
  });

  startProcess(
    "mcp-gateway",
    "./node_modules/.bin/tsx",
    ["apps/mcp-gateway/src/server.ts"],
    {
      ...rootEnv,
      JWT_SECRET: jwtSecret,
      API_BASE_URL: apiBaseUrl,
      MCP_GATEWAY_HOST: "127.0.0.1",
      MCP_GATEWAY_PORT: String(gatewayPort),
    },
  );
  await waitForJson(`${gatewayBaseUrl}/health`);
  const runtimeDiagnostics = await requestJson(
    `${gatewayBaseUrl}/v1/resources/runtime-diagnostics?projectId=${projectId}&limit=10`,
    {
      token: ownerToken,
    },
  );
  if (!runtimeDiagnostics.data?.gateway?.ok || !runtimeDiagnostics.data?.api?.ok) {
    throw new Error("Runtime diagnostics did not report healthy API/Gateway");
  }
  record("runtime diagnostics", {
    projectId,
    gateway: runtimeDiagnostics.data.gateway.status,
    api: runtimeDiagnostics.data.api.status,
    workerTotal: runtimeDiagnostics.data.workerJobs.summary.totalCount,
  });

  await run(
    "frontend production build",
    "npm",
    ["--workspace", "saas-pricing-frontend", "run", "build"],
    {
      ...rootEnv,
      VITE_API_BASE_URL: apiBaseUrl,
    },
  );
  record("frontend build", { apiBaseUrl });

  report.completedAt = new Date().toISOString();
  console.log(JSON.stringify(report, null, 2));

  await stopAll();
}

function assertRehearsalConfig() {
  if (!trialMode) {
    return;
  }

  const missing = [
    "DATABASE_URL",
    "JWT_SECRET",
    "LLM_API_KEY",
    "LLM_MODEL",
    "LLM_BASE_URL",
  ].filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Trial rehearsal requires explicit environment variables: ${missing.join(", ")}`,
    );
  }
}

async function signToken(payload) {
  return new SignJWT({
    displayName: payload.displayName,
    roleCodes: payload.roleCodes,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(jwtSecret));
}

function buildSourceBillImportEvents(input) {
  return [
    {
      projectId: input.projectId,
      resourceType: "ZaoJia_Qd_QdList",
      resourceId: input.billVersionId,
      action: "source_bill.version_imported",
      QdGf: "JS-2014",
      Qdmc: "部署演练源清单",
      IsVisible: true,
      IsDefault: true,
    },
    {
      projectId: input.projectId,
      resourceType: "ZaoJia_Qd_Qdxm",
      resourceId: input.billItemId,
      action: "source_bill.item_imported",
      QdGf: "JS-2014",
      QdID: "SRC-QD-001",
      Qdbh: "A-001",
      Xmmc: "土方工程",
      Dw: "m3",
      Sjxh: 1,
      Dj: 6,
    },
    {
      projectId: input.projectId,
      resourceType: "ZaoJia_Qd_Gznr",
      resourceId: `${input.billItemId}:work-1`,
      action: "source_bill.work_item_imported",
      QdGf: "JS-2014",
      QdID: "SRC-QD-001",
      Sjxh: 1,
      Gznr: "土方开挖、场内倒运、基底清理",
    },
  ];
}

async function seedTrialProjectReferenceData(projectId) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
  });
  try {
    await pool.query(
      `
        insert into project_discipline
          (id, project_id, discipline_code, discipline_name, default_standard_set_code, status)
        values
          ($1, $2, 'building', '建筑工程', 'JS-2014', 'enabled')
        on conflict (id) do nothing
      `,
      [`discipline-${projectId}-building`, projectId],
    );
    await pool.query(
      `
        insert into price_version
          (id, version_code, version_name, region_code, discipline_code, status)
        values
          ($1, $2, '部署演练价目', 'JS', 'building', 'active')
        on conflict (id) do nothing
      `,
      [`price-${projectId}`, `TRIAL-${projectId}-PRICE`],
    );
    await pool.query(
      `
        insert into price_item
          (id, price_version_id, quota_code, labor_unit_price, material_unit_price, machine_unit_price, total_unit_price)
        values
          ($1, $2, '010101', 1, 2, 3, 6)
        on conflict (id) do nothing
      `,
      [`price-item-${projectId}-010101`, `price-${projectId}`],
    );
    await pool.query(
      `
        insert into fee_template
          (id, template_name, project_type, region_code, stage_scope, tax_mode, allocation_mode, status)
        values
          ($1, '部署演练取费', 'building', 'JS', ARRAY['estimate'], 'general', 'proportional', 'active')
        on conflict (id) do nothing
      `,
      [`fee-${projectId}`],
    );
    await pool.query(
      `
        insert into fee_rule
          (id, fee_template_id, discipline_code, fee_type, fee_rate)
        values
          ($1, $2, 'building', 'management_fee', 0.1)
        on conflict (id) do nothing
      `,
      [`fee-rule-${projectId}-management`, `fee-${projectId}`],
    );
    return {
      priceVersionId: `price-${projectId}`,
      feeTemplateId: `fee-${projectId}`,
    };
  } finally {
    await pool.end();
  }
}

function record(name, details = {}) {
  report.checks.push({
    name,
    status: "passed",
    ...details,
  });
}

async function getAvailablePort(startAt) {
  for (let port = startAt; port < startAt + 100; port += 1) {
    if (await canListen(port)) {
      return port;
    }
  }
  throw new Error(`No available port from ${startAt}`);
}

async function canListen(port) {
  const server = net.createServer();
  return new Promise((resolve) => {
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function startProcess(name, command, args, env) {
  const child = spawn(command, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push({ name, child });
  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });
  child.once("exit", (code, signal) => {
    if (code && code !== 0 && code !== 143) {
      process.stderr.write(`[${name}] exited code=${code} signal=${signal ?? ""}\n`);
    }
  });
  return child;
}

async function run(name, command, args, env) {
  const child = spawn(command, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
    process.stderr.write(`[${name}] ${chunk}`);
  });
  const [code] = await once(child, "exit");
  if (code !== 0) {
    throw new Error(`${name} failed with exit code ${code}\n${output}`);
  }
}

async function waitForJson(url, attempts = 60) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function requestJson(url, input = {}) {
  const response = await fetch(url, {
    method: input.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const payload = await response.json();
  const expectedStatus = input.expectedStatus ?? 200;
  if (response.status !== expectedStatus) {
    throw new Error(
      `${url} returned ${response.status}; expected ${expectedStatus}; payload=${JSON.stringify(
        payload,
      )}`,
    );
  }
  return payload;
}

async function stopAll() {
  await Promise.all(
    processes.splice(0).map(async ({ child }) => {
      if (child.exitCode !== null) {
        return;
      }
      child.kill("SIGTERM");
      await Promise.race([
        once(child, "exit"),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }),
  );
}

process.once("SIGINT", () => {
  void stopAll().finally(() => process.exit(130));
});
process.once("SIGTERM", () => {
  void stopAll().finally(() => process.exit(143));
});

main().catch(async (error) => {
  await stopAll();
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
