import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const frontendTestDir = path.join(rootDir, "apps/frontend/test");

const requiredPaths = [
  "package.json",
  "apps/api/package.json",
  "apps/api/src/main.ts",
  "apps/mcp-gateway/package.json",
  "apps/mcp-gateway/src/main.ts",
  "apps/worker/package.json",
  "apps/worker/src/main.ts",
  "apps/ai-runtime/pyproject.toml",
  "apps/ai-runtime/app/main.py",
  "legacy/backend-java/build.gradle.kts",
];

function collectFiles(directory, predicate) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(fullPath, predicate);
    }

    return predicate(fullPath) ? [fullPath] : [];
  });
}

test("repository exposes the new AI-first workspace skeleton", () => {
  for (const relativePath of requiredPaths) {
    const absolutePath = path.join(rootDir, relativePath);
    assert.equal(
      fs.existsSync(absolutePath),
      true,
      `Expected ${relativePath} to exist`,
    );
  }
});

test("root package.json declares the TypeScript workspaces", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
  );

  assert.deepEqual(packageJson.workspaces, [
    "packages/job-contracts",
    "apps/frontend",
    "apps/api",
    "apps/mcp-gateway",
    "apps/worker",
  ]);
});

test("MCP Gateway docs list every exposed capability", async () => {
  const { RESOURCE_DEFINITIONS, TOOL_DEFINITIONS } = await import(
    "../apps/mcp-gateway/src/app/capabilities.ts"
  );
  const readme = fs.readFileSync(
    path.join(rootDir, "apps/mcp-gateway/README.md"),
    "utf8",
  );
  const designDoc = fs.readFileSync(
    path.join(rootDir, "docs/architecture/mcp-capability-design.md"),
    "utf8",
  );

  for (const capability of [...RESOURCE_DEFINITIONS, ...TOOL_DEFINITIONS]) {
    assert.match(readme, new RegExp(`- \`${capability.name}\``));
    assert.match(designDoc, new RegExp(`- \`${capability.name}\``));
  }
});

test("frontend tests avoid real timer waits", () => {
  const frontendTestFiles = collectFiles(frontendTestDir, (filePath) =>
    /\.(ts|tsx)$/.test(filePath),
  );
  const violations = [];

  for (const filePath of frontendTestFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(rootDir, filePath);

    if (/setTimeout\s*\(/.test(content)) {
      violations.push(`${relativePath}: uses setTimeout; prefer fake timers`);
    }

    const newPromiseCount = [...content.matchAll(/new Promise/g)].length;
    const createDeferredCount = [...content.matchAll(/function createDeferred/g)].length;
    if (newPromiseCount > createDeferredCount) {
      violations.push(`${relativePath}: inline Promise wait should use createDeferred helper`);
    }
  }

  assert.deepEqual(violations, []);
});
