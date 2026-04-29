import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const apiAppDir = join(workspaceRoot, "apps/api/src/app");
const outputPath = join(workspaceRoot, "docs/api/openapi-v1.yaml");
const compatibilityOutputPath = join(workspaceRoot, "docs/api/openapi-v1-current.yaml");

const methodOrder = new Map([
  ["get", 0],
  ["post", 1],
  ["put", 2],
  ["delete", 3],
]);

const queryParameterMap = new Map([
  ["/v1/discipline-types", ["regionCode", "status"]],
  ["/v1/fee-templates", ["regionCode", "stageCode", "activeOnly"]],
  ["/v1/jobs", ["projectId", "requestedBy", "jobType", "status", "createdFrom", "createdTo", "completedFrom", "completedTo", "limit"]],
  ["/v1/price-versions", ["regionCode", "disciplineCode", "activeOnly"]],
  ["/v1/price-versions/:priceVersionId/items", ["quotaCode"]],
  ["/v1/projects", ["page", "pageSize"]],
  ["/v1/projects/:projectId/audit-logs", ["resourceType", "resourceId", "resourceIdPrefix", "action", "operatorId", "createdFrom", "createdTo", "limit"]],
  ["/v1/projects/:projectId/ai/recommendations", ["recommendationType", "resourceType", "resourceId", "status", "stageCode", "disciplineCode", "limit"]],
  ["/v1/projects/:projectId/ai/bill-recommendations", ["resourceType", "resourceId", "status", "stageCode", "disciplineCode", "limit"]],
  ["/v1/projects/:projectId/ai/quota-recommendations", ["resourceType", "resourceId", "status", "stageCode", "disciplineCode", "limit"]],
  ["/v1/projects/:projectId/ai/variance-warnings", ["resourceType", "resourceId", "status", "stageCode", "disciplineCode", "limit"]],
  ["/v1/projects/:projectId/bill-versions", ["stageCode", "disciplineCode"]],
  ["/v1/projects/:projectId/import-tasks/:taskId/error-report", ["failureReason", "format"]],
  ["/v1/projects/:projectId/knowledge-entries", ["sourceJobId", "sourceType", "sourceAction", "stageCode", "limit"]],
  ["/v1/projects/:projectId/knowledge-search", ["q", "sourceType", "stageCode", "limit"]],
  ["/v1/projects/:projectId/memory-entries", ["sourceJobId", "subjectType", "subjectId", "stageCode", "limit"]],
  ["/v1/projects/:projectId/process-documents", ["stageCode", "disciplineCode", "documentType", "status"]],
  ["/v1/projects/:projectId/reviews", ["billVersionId", "stageCode", "disciplineCode", "status"]],
  ["/v1/projects/:projectId/workspace", ["stageCode"]],
  ["/v1/reports/summary", ["projectId", "billVersionId", "stageCode", "disciplineCode"]],
  ["/v1/reports/summary/details", ["projectId", "billVersionId", "stageCode", "disciplineCode", "limit"]],
  ["/v1/reports/version-compare", ["projectId", "baseBillVersionId", "targetBillVersionId"]],
  ["/v1/standard-sets", ["disciplineCode", "regionCode", "status"]],
]);

const integerQueryParameters = new Set(["page", "pageSize", "limit"]);
const booleanQueryParameters = new Set(["activeOnly"]);
const enumQueryParameters = new Map([
  ["documentType", ["change_order", "site_visa", "progress_payment"]],
  ["format", ["json", "csv"]],
  ["jobType", ["report_export", "project_recalculate", "knowledge_extraction"]],
  ["recommendationType", ["bill_recommendation", "quota_recommendation", "variance_warning"]],
  ["status", ["queued", "processing", "completed", "failed", "pending", "approved", "rejected", "cancelled", "draft", "submitted", "generated", "accepted", "ignored", "expired"]],
]);

const requestBodyPropertyMap = new Map([
  [
    "PUT /v1/projects/:projectId/status",
    [
      {
        name: "status",
        required: true,
        enumValues: ["draft", "active", "archived"],
      },
    ],
  ],
  [
    "PUT /v1/projects/:projectId/disciplines",
    [
      { name: "disciplines", required: true },
    ],
  ],
  [
    "POST /v1/reports/export",
    [
      { name: "projectId", required: true },
      {
        name: "reportType",
        required: true,
        enumValues: ["summary", "variance", "stage_bill"],
      },
      { name: "stageCode", required: false },
      { name: "disciplineCode", required: false },
      { name: "reportTemplateId", required: false },
      { name: "outputFormat", required: false, enumValues: ["json", "excel", "pdf"] },
    ],
  ],
]);

const parameterDescriptions = new Map([
  ["activeOnly", "Only return active records when true."],
  ["baseBillVersionId", "Base bill version id."],
  ["billVersionId", "Bill version id."],
  ["completedFrom", "Completed time lower bound, ISO 8601."],
  ["completedTo", "Completed time upper bound, ISO 8601."],
  ["createdFrom", "Created time lower bound, ISO 8601."],
  ["createdTo", "Created time upper bound, ISO 8601."],
  ["disciplineCode", "Project discipline code."],
  ["documentType", "Process document type."],
  ["failureReason", "Import failure reason filter."],
  ["format", "Response export format."],
  ["jobType", "Background job type."],
  ["limit", "Maximum number of records to return."],
  ["page", "Page number."],
  ["pageSize", "Page size."],
  ["projectId", "Project id."],
  ["q", "Search query."],
  ["recommendationType", "AI recommendation type."],
  ["regionCode", "Region code."],
  ["resourceIdPrefix", "Resource id prefix filter."],
  ["stageCode", "Project stage code."],
  ["status", "Status filter."],
  ["targetBillVersionId", "Target bill version id."],
]);

const tagRules = [
  ["Auth", (route) => route.path === "/v1/me"],
  ["Reports", (route) => route.path.startsWith("/v1/reports")],
  ["Background Jobs", (route) => route.path.startsWith("/v1/jobs") || route.path.endsWith("/recalculate")],
  ["AI Runtime", (route) => route.path.includes("/ai-runtime")],
  ["AI Recommendations", (route) => route.path.includes("/ai/recommendations") || route.path.includes("/ai/bill-recommendations") || route.path.includes("/ai/quota-recommendations") || route.path.includes("/ai/variance-warnings")],
  ["Import Tasks", (route) => route.path.includes("/import-tasks")],
  ["Knowledge", (route) => route.path.includes("/knowledge") || route.path.includes("/memory")],
  ["Master Data", (route) => route.path === "/v1/discipline-types" || route.path === "/v1/standard-sets"],
  ["Reviews", (route) => route.path.includes("/reviews")],
  ["Process Documents", (route) => route.path.includes("/process-documents")],
  ["Bill Versions", (route) => route.path.includes("/bill-versions") && !route.path.includes("/items")],
  ["Bill Items", (route) => route.path.includes("/bill-versions") && route.path.includes("/items") && !route.path.includes("/work-items") && !route.path.includes("/quota-lines")],
  ["Bill Work Items", (route) => route.path.includes("/work-items")],
  ["Quota Lines", (route) => route.path.includes("/quota-lines")],
  ["Pricing", (route) => route.path.includes("/price-versions") || route.path.includes("/fee-templates") || route.path.includes("/engine/calculate")],
  ["Audit Logs", (route) => route.path.includes("/audit-logs")],
  ["Projects", (route) => route.path.startsWith("/v1/projects")],
];

function collectRegisteredRoutes() {
  return readdirSync(apiAppDir)
    .filter((fileName) => fileName.endsWith(".ts"))
    .flatMap((fileName) => {
      const content = readFileSync(join(apiAppDir, fileName), "utf8");
      return [...content.matchAll(/app\.(get|post|put|delete)\(\s*"([^"]+)"/g)]
        .filter((match) => match[2].startsWith("/v1/"))
        .map((match) => ({
          method: match[1],
          path: match[2],
        }));
    })
    .sort((left, right) => {
      const pathCompare = left.path.localeCompare(right.path);
      if (pathCompare !== 0) {
        return pathCompare;
      }
      return methodOrder.get(left.method) - methodOrder.get(right.method);
    });
}

function toOpenApiPath(path) {
  return path.replaceAll(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function operationIdFor(route) {
  const suffix = route.path
    .replace(/^\/v1\//, "")
    .replaceAll(/:([A-Za-z0-9_]+)/g, "by-$1")
    .split("/")
    .flatMap((part) => part.split("-"))
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  return `${route.method}${suffix}`;
}

function extractPathParameters(path) {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);
}

function renderPathParameters(parameters) {
  return parameters.flatMap((name) => [
    `      - name: ${name}`,
    "        in: path",
    `        description: ${parameterDescriptions.get(name) ?? `${name} path parameter.`}`,
    "        required: true",
    "        schema:",
    "          type: string",
  ]);
}

function renderQueryParameters(parameters) {
  return parameters.flatMap((name) => [
    `      - name: ${name}`,
    "        in: query",
    `        description: ${parameterDescriptions.get(name) ?? `${name} query parameter.`}`,
    "        required: false",
    "        schema:",
    ...renderParameterSchema(name),
  ]);
}

function renderParameterSchema(name) {
  if (integerQueryParameters.has(name)) {
    return ["          type: integer"];
  }

  if (booleanQueryParameters.has(name)) {
    return ["          type: boolean"];
  }

  const enumValues = enumQueryParameters.get(name);
  if (enumValues) {
    return ["          type: string", `          enum: [${enumValues.join(", ")}]`];
  }

  return ["          type: string"];
}

function renderOperation(route) {
  const pathParameters = extractPathParameters(route.path);
  const queryParameters = queryParameterMap.get(route.path) ?? [];
  const lines = [
    `    ${route.method}:`,
    `      operationId: ${operationIdFor(route)}`,
    `      summary: ${route.method.toUpperCase()} ${route.path}`,
    "      tags:",
    `        - ${tagFor(route)}`,
    "      security:",
    "        - bearerAuth: []",
  ];

  if (pathParameters.length > 0 || queryParameters.length > 0) {
    lines.push(
      "      parameters:",
      ...renderPathParameters(pathParameters),
      ...renderQueryParameters(queryParameters),
    );
  }

  if (["post", "put"].includes(route.method)) {
    const requestBodyProperties =
      requestBodyPropertyMap.get(`${route.method.toUpperCase()} ${route.path}`) ??
      [];
    lines.push(
      "      requestBody:",
      `        required: ${requestBodyRequiredFor(route)}`,
      "        content:",
      "          application/json:",
      "            schema:",
      "              type: object",
      "              additionalProperties: true",
      ...renderRequestBodyProperties(requestBodyProperties),
    );
  }

  const successStatus = successStatusFor(route);
  lines.push(
    "      responses:",
    `        '${successStatus}':`,
    `          description: ${successDescriptionFor(successStatus)}`,
    ...renderSuccessContent(route, successStatus),
    "        '401':",
    "          description: Unauthorized",
    ...renderErrorContent(),
    "        '403':",
    "          description: Forbidden",
    ...renderErrorContent(),
    "        '404':",
    "          description: Not Found",
    ...renderErrorContent(),
    "        '422':",
    "          description: Validation Error",
    ...renderErrorContent(),
  );

  return lines;
}

function renderRequestBodyProperties(properties) {
  if (properties.length === 0) {
    return [];
  }

  const requiredNames = properties
    .filter((property) => property.required)
    .map((property) => property.name);

  return [
    ...(requiredNames.length > 0
      ? [`              required: [${requiredNames.join(", ")}]`]
      : []),
    "              properties:",
    ...properties.flatMap((property) => [
      `                ${property.name}:`,
      "                  type: string",
      ...(property.enumValues
        ? [`                  enum: [${property.enumValues.join(", ")}]`]
        : []),
    ]),
  ];
}

function renderErrorContent() {
  return [
    "          content:",
    "            application/json:",
    "              schema:",
    "                $ref: '#/components/schemas/ErrorResponse'",
  ];
}

function tagFor(route) {
  const match = tagRules.find(([, predicate]) => predicate(route));
  return match ? match[0] : "Other";
}

function requestBodyRequiredFor(route) {
  if (route.method === "put") {
    return "true";
  }

  if (route.method !== "post") {
    return "false";
  }

  const optionalPostSuffixes = [
    "/approve",
    "/cancel",
    "/copy-from",
    "/fail",
    "/process",
    "/pull-next",
    "/reject",
    "/retry",
    "/submit",
    "/withdraw",
  ];

  if (optionalPostSuffixes.some((suffix) => route.path.endsWith(suffix))) {
    return "false";
  }

  return "true";
}

function successStatusFor(route) {
  if (route.method === "delete") {
    return "204";
  }

  if (
    route.method === "post" &&
    (route.path.endsWith("/bill-versions") ||
      route.path.endsWith("/copy-from") ||
      route.path.endsWith("/items") ||
      route.path.endsWith("/work-items") ||
      route.path.endsWith("/quota-lines") ||
      route.path.endsWith("/projects") ||
      route.path.endsWith("/process-documents") ||
      route.path.endsWith("/reviews") ||
      route.path.endsWith("/ai/bill-recommendations") ||
      route.path.endsWith("/ai/quota-recommendations") ||
      route.path.endsWith("/ai/variance-warnings"))
  ) {
    return "201";
  }

  if (
    route.method === "post" &&
    (route.path.includes("/ai-runtime/extract-jobs") ||
      route.path.includes("/extract-from-audit") ||
      route.path.includes("/import-tasks") ||
      route.path.includes("/reports/export") ||
      route.path.endsWith("/recalculate"))
  ) {
    return "202";
  }

  return "200";
}

function successDescriptionFor(status) {
  if (status === "201") {
    return "Created";
  }
  if (status === "202") {
    return "Accepted";
  }
  if (status === "204") {
    return "No Content";
  }
  return "Success";
}

function renderSuccessContent(route, status) {
  if (status === "204") {
    return [];
  }

  if (route.path.endsWith("/download")) {
    return [
      "          content:",
      "            application/octet-stream:",
      "              schema:",
      "                type: string",
      "                format: binary",
    ];
  }

  if (route.path.endsWith("/error-report")) {
    return [
      "          content:",
      "            application/json:",
      "              schema:",
      "                type: object",
      "                additionalProperties: true",
      "            text/csv:",
      "              schema:",
      "                type: string",
    ];
  }

  return [
    "          content:",
    "            application/json:",
    "              schema:",
    `                $ref: '#/components/schemas/${successSchemaFor(route)}'`,
  ];
}

function successSchemaFor(route) {
  if (route.method === "get" && !route.path.endsWith("/download") && !route.path.endsWith("/error-report")) {
    return "ListEnvelope";
  }
  return "ObjectEnvelope";
}

function renderDocument(routes) {
  const grouped = new Map();
  for (const route of routes) {
    const path = toOpenApiPath(route.path);
    const existing = grouped.get(path) ?? [];
    existing.push(route);
    grouped.set(path, existing);
  }

  const lines = [
    "openapi: 3.1.0",
    "info:",
    "  title: 新点 SaaS 造价系统 API",
    "  version: 1.0.0-current",
    "  summary: 当前代码已注册的 V1 API 最小契约",
    "  description: |",
    "    自动生成文件，请勿手工编辑。",
    "    生成命令：npm run docs:openapi-current",
    "servers:",
    "  - url: http://localhost:3000",
    "    description: Local",
    "externalDocs:",
    "  description: 当前已实现 V1 API 路由清单",
    "  url: ./implemented-v1-routes.md",
    "tags:",
    ...[...new Set(routes.map((route) => tagFor(route)))]
      .sort()
      .map((name) => `  - name: ${name}`),
    "components:",
    "  securitySchemes:",
    "    bearerAuth:",
    "      type: http",
    "      scheme: bearer",
    "      bearerFormat: JWT",
    "  schemas:",
    "    ErrorResponse:",
    "      type: object",
    "      required: [error]",
    "      properties:",
    "        error:",
    "          type: object",
    "          required: [code, message]",
    "          properties:",
    "            code:",
    "              type: string",
    "            message:",
    "              type: string",
    "            details:",
    "              type: object",
    "              additionalProperties: true",
    "    ObjectEnvelope:",
    "      type: object",
    "      additionalProperties: true",
    "    ListEnvelope:",
    "      type: object",
    "      properties:",
    "        items:",
    "          type: array",
    "          items:",
    "            type: object",
    "            additionalProperties: true",
    "      additionalProperties: true",
    "paths:",
  ];

  for (const [path, pathRoutes] of grouped) {
    lines.push(`  ${path}:`);
    for (const route of pathRoutes) {
      lines.push(...renderOperation(route));
    }
  }

  return `${lines.join("\n")}\n`;
}

const document = renderDocument(collectRegisteredRoutes());
writeFileSync(outputPath, document);
writeFileSync(compatibilityOutputPath, document);
