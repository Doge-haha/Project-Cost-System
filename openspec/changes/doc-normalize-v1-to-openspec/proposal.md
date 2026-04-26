# Proposal: 文档规范化为 OpenSpec

## 背景

当前仓库已经有一份完整的业务设计基线文档 [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)，但内容集中在单个大文档中，不利于后续按专题演进、评审差异和持续维护。

本提案的目标是把现有 `v1.0` 设计文档中最核心、最稳定的内容，整理成 `OpenSpec` 风格的变更目录，作为后续文档拆分和演进的起点。

## 本次变更范围

本次仅整理文档，不修改代码、不推动新实现，范围限定为：

- 提取“9 阶段业务模型”为单独 spec。
- 记录仓库当前架构现状，作为 design 文档。
- 生成 tasks 清单，明确后续文档规范化动作。

## 明确不做

本次不包含以下内容：

- 不改动任何业务代码、接口或数据库结构。
- 不把“目标架构”误写成“当前架构”。
- 不拆分全部设计文档章节，只先建立 OpenSpec 基础骨架。
- 不新增新的业务需求或实现承诺。

## 输入来源

- [设计文档_v1.0_优化中.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/设计文档_v1.0_优化中.md)
- [README.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/README.md)
- [project-document-index.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/project-document-index.md)
- [backend-architecture-redesign.md](/Users/huahaha/WorkSpace/something/新点SaaS计价/docs/architecture/backend-architecture-redesign.md)

## 预期结果

完成后，仓库会新增一套可持续维护的 OpenSpec 变更目录：

- `proposal.md` 说明为什么要做这次规范化。
- `specs/business-stage-model/spec.md` 固化 9 阶段业务模型。
- `design.md` 描述当前仓库现状和文档边界。
- `tasks.md` 跟踪后续文档整理工作。
