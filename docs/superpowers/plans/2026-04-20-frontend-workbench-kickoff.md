# Frontend Workbench Kickoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/frontend` 启动一个可联调的 React + TypeScript + Vite 最小工作台，打通项目、清单、汇总 3 条前端主链。

**Architecture:** 前端先采用轻量骨架，不引入复杂状态层或设计系统基础设施，优先围绕现有 `apps/api` 提供的稳定接口构建页面和最小路由。首版只覆盖“读为主、少量导航与切换”的工作台结构，保证 `project -> bill_version -> bill_item -> summary` 主链可见、可联调、可持续迭代。

**Tech Stack:** Vite, React, TypeScript, React Router, Fetch API, CSS variables.

---

## Scope

本计划只启动最小工作台，不做完整产品化前端。

本阶段包含：

- 初始化 `apps/frontend` 的 Vite + React + TypeScript 骨架
- 建立最小路由和页面布局
- 对接项目列表、项目详情、清单页、汇总页 4 条路径
- 提供统一 API 请求层和开发环境变量入口
- 补最小 smoke 验证

本阶段不包含：

- 登录页与完整鉴权流
- 复杂表格编辑器
- 主题系统与组件库抽象
- 审核流、流程单、MCP 可视化入口

## File Structure

### New files

- `apps/frontend/index.html`
  - Vite 入口 HTML
- `apps/frontend/tsconfig.json`
  - 前端 TypeScript 配置
- `apps/frontend/tsconfig.node.json`
  - Vite 配置类型支持
- `apps/frontend/vite.config.ts`
  - Vite 开发配置
- `apps/frontend/src/main.tsx`
  - React 挂载入口
- `apps/frontend/src/app/App.tsx`
  - 应用根组件和路由挂载
- `apps/frontend/src/app/router.tsx`
  - 路由定义
- `apps/frontend/src/app/layout.tsx`
  - 最小工作台布局
- `apps/frontend/src/styles/global.css`
  - 全局样式与 CSS 变量
- `apps/frontend/src/lib/api.ts`
  - API 请求封装
- `apps/frontend/src/lib/config.ts`
  - 环境变量解析
- `apps/frontend/src/lib/types.ts`
  - 页面使用的最小类型定义
- `apps/frontend/src/features/projects/projects-page.tsx`
  - 项目列表页
- `apps/frontend/src/features/projects/project-detail-page.tsx`
  - 项目详情页
- `apps/frontend/src/features/bills/bill-items-page.tsx`
  - 清单页
- `apps/frontend/src/features/reports/summary-page.tsx`
  - 汇总页
- `apps/frontend/src/features/shared/loading-state.tsx`
  - 通用加载态
- `apps/frontend/src/features/shared/error-state.tsx`
  - 通用错误态
- `apps/frontend/src/features/shared/empty-state.tsx`
  - 通用空态
- `apps/frontend/test/smoke.test.tsx`
  - 前端最小 smoke 测试

### Modified files

- `apps/frontend/package.json`
  - 增加前端依赖与脚本
- `README.md`
  - 补前端启动命令

## Task 1: Frontend Package Scaffold

**Files:**
- Modify: `apps/frontend/package.json`
- Create: `apps/frontend/index.html`
- Create: `apps/frontend/tsconfig.json`
- Create: `apps/frontend/tsconfig.node.json`
- Create: `apps/frontend/vite.config.ts`

- [ ] 增加 `dev`、`build`、`test`、`typecheck` 脚本
- [ ] 增加 `react`、`react-dom`、`react-router-dom`、`vite`、`typescript` 等最小依赖
- [ ] 建立 Vite 可启动的基础配置

**Acceptance check:**

- `npm --workspace saas-pricing-frontend run typecheck`

## Task 2: App Shell and Routing

**Files:**
- Create: `apps/frontend/src/main.tsx`
- Create: `apps/frontend/src/app/App.tsx`
- Create: `apps/frontend/src/app/router.tsx`
- Create: `apps/frontend/src/app/layout.tsx`
- Create: `apps/frontend/src/styles/global.css`

- [ ] 建立应用入口和工作台布局
- [ ] 定义 4 条路由：项目列表、项目详情、清单页、汇总页
- [ ] 做桌面优先、移动端不崩的最小响应式布局

**Acceptance check:**

- `npm --workspace saas-pricing-frontend run dev`

## Task 3: API Client and Runtime Config

**Files:**
- Create: `apps/frontend/src/lib/api.ts`
- Create: `apps/frontend/src/lib/config.ts`
- Create: `apps/frontend/src/lib/types.ts`

- [ ] 约定 `VITE_API_BASE_URL`
- [ ] 封装项目列表、项目详情、清单项、汇总查询的最小请求方法
- [ ] 提供统一错误处理，避免页面层散落 `fetch`

**Acceptance check:**

- `npm --workspace saas-pricing-frontend run typecheck`

## Task 4: Projects Pages

**Files:**
- Create: `apps/frontend/src/features/projects/projects-page.tsx`
- Create: `apps/frontend/src/features/projects/project-detail-page.tsx`
- Create: `apps/frontend/src/features/shared/loading-state.tsx`
- Create: `apps/frontend/src/features/shared/error-state.tsx`
- Create: `apps/frontend/src/features/shared/empty-state.tsx`

- [ ] 实现项目列表页
- [ ] 实现项目详情页，展示阶段、专业、成员与主导航入口
- [ ] 补加载、错误、空态组件

**Acceptance check:**

- 项目页在本地 API 可返回数据时能正常渲染

## Task 5: Bill Items and Summary Pages

**Files:**
- Create: `apps/frontend/src/features/bills/bill-items-page.tsx`
- Create: `apps/frontend/src/features/reports/summary-page.tsx`

- [ ] 实现清单页，先展示当前版本清单和层级摘要
- [ ] 实现汇总页，展示总金额、系统值/最终值、偏差摘要
- [ ] 从项目详情页接通导航

**Acceptance check:**

- `project -> bill items -> summary` 页面跳转正常

## Task 6: Frontend Smoke Verification

**Files:**
- Create: `apps/frontend/test/smoke.test.tsx`
- Modify: `apps/frontend/package.json`
- Modify: `README.md`

- [ ] 补一个最小 smoke 测试，验证根路由可渲染
- [ ] README 增加前端启动与 API 联调说明
- [ ] 跑前端类型检查与测试

**Acceptance check:**

- `npm --workspace saas-pricing-frontend test`
- `npm --workspace saas-pricing-frontend run typecheck`

## Task 7: Full Verification

**Files:**
- Verify whole workspace

- [ ] 跑前端 workspace 验证
- [ ] 跑整仓类型检查
- [ ] 跑整仓测试，确保新 frontend workspace 不引入回归

**Acceptance check:**

- `npm --workspace saas-pricing-frontend test`
- `npm --workspace saas-pricing-frontend run typecheck`
- `npm run typecheck`
- `npm test`
