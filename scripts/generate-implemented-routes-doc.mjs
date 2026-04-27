import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiAppDir = join(workspaceRoot, "apps/api/src/app");
const outputPath = join(workspaceRoot, "docs/api/implemented-v1-routes.md");

const SECTION_RULES = [
  ["Auth", (route) => route.path === "/v1/me"],
  ["Projects", (route) => route.path.startsWith("/v1/projects") && !matchesAny(route.path, ["bill-versions", "reviews", "process-documents", "quota-lines", "ai-runtime", "import-tasks", "knowledge", "memory", "audit-logs", "recalculate"])],
  ["Bill Versions", (route) => route.path.includes("/bill-versions") && !route.path.includes("/items") && !route.path.includes("/reviews")],
  ["Bill Items", (route) => route.path.includes("/bill-versions") && route.path.includes("/items") && !matchesAny(route.path, ["work-items", "quota-lines"])],
  ["Bill Work Items", (route) => route.path.includes("/work-items")],
  ["Quota Lines", (route) => route.path.includes("/quota-lines")],
  ["Reviews", (route) => route.path.includes("/reviews")],
  ["Process Documents", (route) => route.path.includes("/process-documents")],
  ["Pricing / Fee / Engine", (route) => matchesAny(route.path, ["/v1/price-versions", "/v1/fee-templates", "/v1/engine"])],
  ["Reports", (route) => route.path.startsWith("/v1/reports")],
  ["Audit Logs", (route) => route.path.includes("/audit-logs")],
  ["Background Jobs", (route) => route.path.startsWith("/v1/jobs") || route.path.endsWith("/recalculate")],
  ["AI Recommendations", (route) => route.path.includes("/ai/recommendations") || route.path.includes("/ai/bill-recommendations") || route.path.includes("/ai/quota-recommendations") || route.path.includes("/ai/variance-warnings")],
  ["AI Runtime / Knowledge", (route) => matchesAny(route.path, ["/v1/ai-runtime", "/ai-runtime/", "/knowledge-", "/memory-"])],
  ["Import Tasks", (route) => route.path.includes("/import-tasks")],
];

const GATEWAY_COVERAGE = [
  "reports summary / details / export",
  "jobs list / status / retry",
  "AI runtime preview / extract jobs / extract from audit",
  "knowledge entries",
  "import tasks / error report / upload retry scope",
  "reviews",
  "review workflow decisions",
  "process documents",
  "process document workflow status",
  "project recalculate",
];

function matchesAny(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern));
}

function collectRegisteredRoutes() {
  return readdirSync(apiAppDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .flatMap((fileName) => {
      const content = readFileSync(join(apiAppDir, fileName), "utf8");
      return [...content.matchAll(/app\.(get|post|put|delete)\(\s*"([^"]+)"/g)]
        .filter((match) => match[2].startsWith("/v1/"))
        .map((match) => ({
          method: match[1].toUpperCase(),
          path: match[2],
          sourceFile: fileName,
        }));
    })
    .sort((left, right) =>
      `${left.path} ${left.method}`.localeCompare(`${right.path} ${right.method}`),
    );
}

function groupRoutes(routes) {
  const groups = new Map(SECTION_RULES.map(([name]) => [name, []]));
  const unmatched = [];

  for (const route of routes) {
    const target = SECTION_RULES.find(([, predicate]) => predicate(route));
    if (target) {
      groups.get(target[0]).push(route);
    } else {
      unmatched.push(route);
    }
  }

  if (unmatched.length > 0) {
    groups.set("Other", unmatched);
  }

  return groups;
}

function renderDocument(routes) {
  const groups = groupRoutes(routes);
  const nonEmptyGroupCount = [...groups.values()].filter((sectionRoutes) => sectionRoutes.length > 0).length;
  const methodCounts = ["GET", "POST", "PUT", "DELETE"].map((method) => [
    method,
    routes.filter((route) => route.method === method).length,
  ]);
  const sourceFiles = [...new Set(routes.map((route) => route.sourceFile))].sort();
  const lines = [
    "# 当前已实现 V1 API 路由",
    "",
    "日期：2026-04-25",
    "",
    "说明：",
    "",
    "- 本文件记录当前代码已注册的 `/v1` 路由。",
    "- `openapi-v1.yaml` 为当前 `/v1` 生成契约。",
    "- 历史 `/api/v1` 草案已归档到 `openapi-v1-legacy.yaml`。",
    "- 本文件由 `npm run docs:api-routes` 生成。",
    "",
    "摘要：",
    "",
    `- 路由总数：${routes.length}`,
    `- 分组总数：${nonEmptyGroupCount}`,
    `- 方法分布：${methodCounts.map(([method, count]) => `${method} ${count}`).join(" / ")}`,
    `- 源文件：${sourceFiles.map((fileName) => `apps/api/src/app/${fileName}`).join(" / ")}`,
    "",
  ];

  for (const [name, sectionRoutes] of groups) {
    if (sectionRoutes.length === 0) {
      continue;
    }

    lines.push(`## ${name}`, "");
    for (const route of sectionRoutes) {
      lines.push(`- \`${route.method} ${route.path}\``);
    }
    lines.push("");
  }

  lines.push("## MCP Gateway 对应覆盖", "");
  lines.push("Gateway 已通过注入式 e2e 覆盖以下 API 主线：", "");
  for (const item of GATEWAY_COVERAGE) {
    lines.push(`- ${item}`);
  }
  lines.push("");

  return `${lines.join("\n").trimEnd()}\n`;
}

writeFileSync(outputPath, renderDocument(collectRegisteredRoutes()));
