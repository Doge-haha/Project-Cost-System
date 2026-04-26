import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const changeRoot = join(workspaceRoot, "openspec/changes/doc-normalize-v1-to-openspec");
const specsRoot = join(changeRoot, "specs");
const indexPath = join(changeRoot, "index.md");
const tasksPath = join(changeRoot, "tasks.md");
const readmePath = join(workspaceRoot, "README.md");

function collectSpecSlugs() {
  return readdirSync(specsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

test("OpenSpec index lists every normalized spec", () => {
  const index = readFileSync(indexPath, "utf8");

  for (const slug of collectSpecSlugs()) {
    assert.match(index, new RegExp(`specs/${slug}/spec\\.md`));
  }
});

test("OpenSpec specs follow the normalized spec skeleton", () => {
  for (const slug of collectSpecSlugs()) {
    const specPath = join(specsRoot, slug, "spec.md");
    const content = readFileSync(specPath, "utf8");

    assert.match(content, /^# Spec: /m, `${slug} is missing title`);
    assert.match(content, /^## 概述$/m, `${slug} is missing overview`);
    assert.match(content, /^## ADDED Requirements$/m, `${slug} is missing requirements`);
    assert.match(content, /^### Requirement: /m, `${slug} is missing requirement entries`);
  }
});

test("OpenSpec error handling topic is split and tracked", () => {
  const tasks = readFileSync(tasksPath, "utf8");
  const specPath = join(specsRoot, "error-handling/spec.md");

  assert.equal(existsSync(specPath), true);
  assert.match(tasks, /- \[x\] 将“错误处理专题”整理为独立 spec。/);
});

test("OpenSpec background job bus topic is split and tracked", () => {
  const tasks = readFileSync(tasksPath, "utf8");
  const specPath = join(specsRoot, "background-job-bus/spec.md");

  assert.equal(existsSync(specPath), true);
  assert.match(tasks, /- \[x\] 将“后台任务总线专题”整理为独立 spec。/);
});

test("OpenSpec operations observability topic is split and tracked", () => {
  const tasks = readFileSync(tasksPath, "utf8");
  const specPath = join(specsRoot, "operations-observability/spec.md");

  assert.equal(existsSync(specPath), true);
  assert.match(tasks, /- \[x\] 将“运维观测专题”整理为独立 spec。/);
});

test("root README points to the OpenSpec normalized index", () => {
  const readme = readFileSync(readmePath, "utf8");

  assert.match(readme, /OpenSpec 规范化索引/);
  assert.match(readme, /openspec\/changes\/doc-normalize-v1-to-openspec\/index\.md/);
});

test("OpenSpec non-goals remain explicitly out of scope", () => {
  const tasks = readFileSync(tasksPath, "utf8");

  assert.match(tasks, /- \[ \] 不拆分全部功能模块章节。/);
  assert.match(tasks, /- \[ \] 不把架构建议文档改写为实现文档。/);
  assert.match(tasks, /- \[ \] 不新增代码任务、接口任务或数据库任务。/);
});

test("OpenSpec follow-up section has no pending split topics", () => {
  const tasks = readFileSync(tasksPath, "utf8");
  const followUpSection = tasks.split("## 4. 后续建议")[1] ?? "";

  assert.doesNotMatch(followUpSection, /- \[ \]/);
});
