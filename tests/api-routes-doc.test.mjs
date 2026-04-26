import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiAppDir = join(workspaceRoot, "apps/api/src/app");
const routeDocPath = join(workspaceRoot, "docs/api/implemented-v1-routes.md");
const openApiPath = join(workspaceRoot, "docs/api/openapi-v1.yaml");
const legacyOpenApiPath = join(workspaceRoot, "docs/api/openapi-v1-legacy.yaml");
const currentOpenApiPath = join(workspaceRoot, "docs/api/openapi-v1-current.yaml");
const apiReadmePath = join(workspaceRoot, "docs/api/README.md");

function collectRegisteredRoutes() {
  return readdirSync(apiAppDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .flatMap((fileName) => {
      const content = readFileSync(join(apiAppDir, fileName), "utf8");
      return [...content.matchAll(/app\.(get|post|put|delete)\(\s*"([^"]+)"/g)]
        .filter((match) => match[2].startsWith("/v1/"))
        .map((match) => `${match[1].toUpperCase()} ${match[2]}`);
    })
    .sort();
}

function collectRouteSourceFiles() {
  return readdirSync(apiAppDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .filter((fileName) => {
      const content = readFileSync(join(apiAppDir, fileName), "utf8");
      return [...content.matchAll(/app\.(get|post|put|delete)\(\s*"([^"]+)"/g)].some((match) =>
        match[2].startsWith("/v1/"),
      );
    })
    .map((fileName) => `apps/api/src/app/${fileName}`)
    .sort();
}

function collectDocumentedRoutes() {
  const content = readFileSync(routeDocPath, "utf8");
  return [...content.matchAll(/- `(GET|POST|PUT|DELETE) (\/v1\/[^`]+)`/g)]
    .map((match) => `${match[1]} ${match[2]}`)
    .sort();
}

function toOpenApiPath(path) {
  return path.replaceAll(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function collectCurrentOpenApiPaths() {
  const content = readFileSync(openApiPath, "utf8");
  return [...content.matchAll(/^  (\/v1\/[^:]+):$/gm)]
    .map((match) => match[1])
    .sort();
}

function collectCurrentOpenApiOperations() {
  const content = readFileSync(openApiPath, "utf8");
  const operations = [];
  let currentPath = null;

  for (const line of content.split("\n")) {
    const pathMatch = line.match(/^  (\/v1\/[^:]+):$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }

    const methodMatch = line.match(/^    (get|post|put|delete):$/);
    if (!currentPath || !methodMatch) {
      continue;
    }

    operations.push(`${methodMatch[1].toUpperCase()} ${currentPath}`);
  }

  return operations.sort();
}

function collectCurrentOpenApiPathParameterNames(path) {
  const content = readFileSync(openApiPath, "utf8");
  const lines = content.split("\n");
  const pathStart = lines.findIndex((line) => line === `  ${path}:`);
  if (pathStart < 0) {
    return [];
  }

  const pathEnd = lines.findIndex((line, index) => index > pathStart && /^  \/v1\/[^:]+:$/.test(line));
  const block = lines.slice(pathStart, pathEnd < 0 ? lines.length : pathEnd).join("\n");
  const names = [];
  const parameterPattern = /- name: ([A-Za-z0-9_]+)\n        in: path/g;

  for (const match of block.matchAll(parameterPattern)) {
    names.push(match[1]);
  }

  return [...new Set(names)].sort();
}

test("implemented V1 API route document matches registered routes", () => {
  assert.deepEqual(collectDocumentedRoutes(), collectRegisteredRoutes());
});

test("implemented route document has no fallback Other section", () => {
  const content = readFileSync(routeDocPath, "utf8");

  assert.doesNotMatch(content, /^## Other$/m);
});

test("implemented route document includes generated summary counts", () => {
  const content = readFileSync(routeDocPath, "utf8");
  const routes = collectRegisteredRoutes();
  const documentedSectionCount = [...content.matchAll(/^## /gm)].length - 1;
  const methodSummary = ["GET", "POST", "PUT", "DELETE"]
    .map((method) => {
      const count = routes.filter((route) => route.startsWith(`${method} `)).length;
      return `${method} ${count}`;
    })
    .join(" / ");
  const sourceSummary = collectRouteSourceFiles().join(" / ");

  assert.match(content, new RegExp(`- 路由总数：${routes.length}`));
  assert.match(content, new RegExp(`- 分组总数：${documentedSectionCount}`));
  assert.match(content, new RegExp(`- 方法分布：${methodSummary}`));
  assert.match(content, new RegExp(`- 源文件：${sourceSummary}`));
});

test("legacy OpenAPI draft is archived away from the current contract path", () => {
  const content = readFileSync(legacyOpenApiPath, "utf8");
  const legacyPathCount = [...content.matchAll(/^  \/api\/v1/gm)].length;
  const currentPathCount = [...content.matchAll(/^  \/v1/gm)].length;

  assert.match(content, /历史契约草案/);
  assert.match(content, /docs\/api\/implemented-v1-routes\.md/);
  assert.equal(legacyPathCount, 18);
  assert.equal(currentPathCount, 0);
});

test("implemented route document is generated from the route collector", () => {
  const before = readFileSync(routeDocPath, "utf8");

  execFileSync("node", ["scripts/generate-implemented-routes-doc.mjs"], {
    cwd: workspaceRoot,
    stdio: "pipe",
  });

  const after = readFileSync(routeDocPath, "utf8");
  assert.equal(after, before);
});

test("current OpenAPI document is generated and matches registered route paths", () => {
  const before = readFileSync(openApiPath, "utf8");
  const beforeCompatibility = readFileSync(currentOpenApiPath, "utf8");

  execFileSync("node", ["scripts/generate-openapi-v1-current.mjs"], {
    cwd: workspaceRoot,
    stdio: "pipe",
  });

  const after = readFileSync(openApiPath, "utf8");
  const afterCompatibility = readFileSync(currentOpenApiPath, "utf8");
  const expectedPaths = [
    ...new Set(
      collectRegisteredRoutes().map((route) =>
        toOpenApiPath(route.replace(/^(GET|POST|PUT|DELETE) /, "")),
      ),
    ),
  ].sort();

  assert.equal(after, before);
  assert.equal(afterCompatibility, beforeCompatibility);
  assert.equal(afterCompatibility, after);
  assert.deepEqual(collectCurrentOpenApiPaths(), expectedPaths);
});

test("current OpenAPI document matches registered route methods", () => {
  const expectedOperations = collectRegisteredRoutes()
    .map((route) => {
      const [method, path] = route.split(" ");
      return `${method} ${toOpenApiPath(path)}`;
    })
    .sort();

  assert.deepEqual(collectCurrentOpenApiOperations(), expectedOperations);
});

test("current OpenAPI document includes all path parameters", () => {
  for (const route of collectRegisteredRoutes()) {
    const [, registeredPath] = route.split(" ");
    const openApiPath = toOpenApiPath(registeredPath);
    const expectedParameters = [...registeredPath.matchAll(/:([A-Za-z0-9_]+)/g)]
      .map((match) => match[1])
      .sort();

    assert.deepEqual(collectCurrentOpenApiPathParameterNames(openApiPath), expectedParameters);
  }
});

test("current OpenAPI document points to generated route list", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /externalDocs:\n  description: 当前已实现 V1 API 路由清单\n  url: \.\/implemented-v1-routes\.md/);
});

test("current OpenAPI document includes important query parameters", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /\/v1\/reports\/summary:[\s\S]*- name: projectId[\s\S]*in: query/);
  assert.match(content, /\/v1\/reports\/summary\/details:[\s\S]*- name: limit[\s\S]*in: query/);
  assert.match(content, /\/v1\/jobs:[\s\S]*- name: status[\s\S]*in: query/);
  assert.match(content, /\/v1\/projects\/\{projectId\}\/audit-logs:[\s\S]*- name: resourceIdPrefix[\s\S]*in: query/);
  assert.match(content, /\/v1\/projects\/\{projectId\}\/import-tasks\/\{taskId\}\/error-report:[\s\S]*- name: failureReason[\s\S]*in: query/);
});

test("current OpenAPI document uses non-200 success codes where routes do", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /\/v1\/projects:[\s\S]*post:[\s\S]*'201':[\s\S]*description: Created/);
  assert.match(content, /\/v1\/reports\/export:[\s\S]*post:[\s\S]*'202':[\s\S]*description: Accepted/);
  assert.match(content, /\/v1\/projects\/\{projectId\}\/bill-versions\/\{billVersionId\}\/items\/\{itemId\}:[\s\S]*delete:[\s\S]*'204':[\s\S]*description: No Content/);
});

test("current OpenAPI document includes query parameter types and enums", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /- name: limit[\s\S]*in: query[\s\S]*schema:\n          type: integer/);
  assert.match(content, /- name: activeOnly[\s\S]*in: query[\s\S]*schema:\n          type: boolean/);
  assert.match(content, /- name: format[\s\S]*in: query[\s\S]*enum: \[json, csv\]/);
  assert.match(content, /- name: documentType[\s\S]*in: query[\s\S]*enum: \[change_order, site_visa, progress_payment\]/);
  assert.match(content, /- name: jobType[\s\S]*in: query[\s\S]*enum: \[report_export, project_recalculate, knowledge_extraction\]/);
});

test("current OpenAPI document marks request bodies as required where needed", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /\/v1\/projects:[\s\S]*post:[\s\S]*requestBody:\n        required: true/);
  assert.match(content, /\/v1\/projects\/\{projectId\}\/stages:[\s\S]*put:[\s\S]*requestBody:\n        required: true/);
  assert.match(content, /\/v1\/projects\/\{projectId\}\/reviews\/\{reviewSubmissionId\}\/approve:[\s\S]*post:[\s\S]*requestBody:\n        required: false/);
});

test("current OpenAPI document includes common error responses and download content types", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /'404':\n          description: Not Found/);
  assert.match(content, /'422':\n          description: Validation Error/);
  assert.match(content, /\/v1\/reports\/export\/\{taskId\}\/download:[\s\S]*application\/octet-stream:[\s\S]*format: binary/);
  assert.match(content, /\/v1\/projects\/\{projectId\}\/import-tasks\/\{taskId\}\/error-report:[\s\S]*application\/json:[\s\S]*text\/csv:/);
});

test("current OpenAPI document includes top-level and operation tags", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /^tags:\n(?:  - name: .+\n)+components:/m);
  assert.doesNotMatch(content, /- name: Other/);
  assert.doesNotMatch(content, /- Other/);
  assert.match(content, /\/v1\/reports\/summary:[\s\S]*tags:\n        - Reports/);
  assert.match(content, /\/v1\/jobs:[\s\S]*tags:\n        - Background Jobs/);
  assert.match(content, /\/v1\/projects\/\{projectId\}\/bill-versions:[\s\S]*tags:\n        - Bill Versions/);
});

test("current OpenAPI document has unique operation ids", () => {
  const content = readFileSync(openApiPath, "utf8");
  const operationIds = [...content.matchAll(/operationId: ([A-Za-z0-9]+)/g)].map(
    (match) => match[1],
  );

  assert.equal(operationIds.length, new Set(operationIds).size);
});

test("current OpenAPI document includes parameter descriptions", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /- name: projectId\n        in: path\n        description: Project id\./);
  assert.match(content, /- name: stageCode\n        in: query\n        description: Project stage code\./);
  assert.match(content, /- name: failureReason\n        in: query\n        description: Import failure reason filter\./);
  assert.match(content, /- name: baseBillVersionId\n        in: query\n        description: Base bill version id\./);
  assert.match(content, /- name: targetBillVersionId\n        in: query\n        description: Target bill version id\./);
});

test("current OpenAPI document references shared error response schema", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /ErrorResponse:[\s\S]*required: \[error\]/);
  assert.match(content, /'401':[\s\S]*\$ref: '#\/components\/schemas\/ErrorResponse'/);
  assert.match(content, /'422':[\s\S]*\$ref: '#\/components\/schemas\/ErrorResponse'/);
});

test("current OpenAPI document references shared success envelope schemas", () => {
  const content = readFileSync(openApiPath, "utf8");

  assert.match(content, /ObjectEnvelope:[\s\S]*additionalProperties: true/);
  assert.match(content, /ListEnvelope:[\s\S]*items:/);
  assert.match(content, /\/v1\/projects:[\s\S]*get:[\s\S]*\$ref: '#\/components\/schemas\/ListEnvelope'/);
  assert.match(content, /\/v1\/projects:[\s\S]*post:[\s\S]*\$ref: '#\/components\/schemas\/ObjectEnvelope'/);
});

test("API README points to generated current contract files", () => {
  const content = readFileSync(apiReadmePath, "utf8");

  assert.match(content, /implemented-v1-routes\.md/);
  assert.match(content, /openapi-v1\.yaml/);
  assert.match(content, /openapi-v1-current\.yaml/);
  assert.match(content, /openapi-v1-legacy\.yaml/);
  assert.match(content, /path 参数与代码注册路由一致/);
  assert.match(content, /npm run docs:api/);
  assert.match(content, /tests\/api-routes-doc\.test\.mjs/);
});
