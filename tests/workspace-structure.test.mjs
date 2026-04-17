import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

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

test("root package.json declares the TypeScript workspace apps", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, "package.json"), "utf8"),
  );

  assert.deepEqual(packageJson.workspaces, [
    "apps/frontend",
    "apps/api",
    "apps/mcp-gateway",
    "apps/worker",
  ]);
});
