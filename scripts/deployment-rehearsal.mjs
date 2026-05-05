import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

import { SignJWT } from "jose";
import pg from "pg";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/saas_pricing";
const jwtSecret = process.env.JWT_SECRET ?? "deployment-rehearsal-secret";
const cliArgs = new Set(process.argv.slice(2));
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
  await seedTrialProjectDisciplines(projectId);
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
  record("business sample bill setup", {
    projectId,
    billVersionId,
    billItemId: billItem.id,
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
      MAX_ITERATIONS: "1",
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

async function seedTrialProjectDisciplines(projectId) {
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
