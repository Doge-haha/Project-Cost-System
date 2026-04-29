# 新点 SaaS 造价系统 Iteration 1 任务拆分

> 基于 [2026-04-16-saas-pricing-v1-implementation.md](/Users/huahaha/Documents/New%20project/docs/superpowers/plans/2026-04-16-saas-pricing-v1-implementation.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)、[permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 与 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 整理。

## 1. 迭代目标

Iteration 1 不是把整套造价系统一次做完，而是先把“项目可创建、阶段可配置、专业可绑定、成员可授权、工作台可进入”这条主链跑通。

本迭代重点覆盖：

- 项目创建与详情
- 阶段模板展开与阶段配置
- 项目成员与权限范围
- 项目专业配置
- 定额集只读查询
- 阶段工作台基础视图
- 源数据导入的前置准备能力

本迭代不要求完成：

- 清单正式编制
- 定额正式套用
- 计价引擎
- 审核流完整闭环
- 报表导出

## 2. 交付范围

### 2.1 后端交付

- `project`、`project_stage`、`project_member`、`project_role_scope`
- `discipline_type`、`standard_set`、`project_discipline`
- 项目、阶段、专业配置相关接口
- 定额集查询接口
- 项目成员与权限落库
- 阶段工作台基础聚合接口

### 2.2 前端交付

- 项目列表页
- 项目创建/编辑页
- 项目详情页
- 阶段配置页
- 成员与权限配置页
- 项目专业配置页
- 阶段工作台基础页

### 2.3 测试交付

- 核心建表迁移验证
- 权限校验测试
- 项目创建主流程集成测试
- 阶段配置与专业配置集成测试

## 3. 任务拆分

## 3.1 数据库与迁移

### 3.1.1 建表任务

- [ ] 创建 `project`
- [ ] 创建 `project_stage`
- [ ] 创建 `project_member`
- [ ] 创建 `project_role_scope`
- [x] 创建 `discipline_type`
- [x] 创建 `standard_set`
- [ ] 创建 `project_discipline`

### 3.1.2 约束与索引

- [x] 为 `project.project_code` 建唯一索引
- [x] 为 `project_stage(project_id, stage_code)` 建唯一索引
- [x] 为 `project_member(project_id, user_id)` 建唯一索引
- [x] 为 `project_discipline(project_id, discipline_code)` 建唯一索引
- [x] 为 `discipline_type.discipline_code` 建唯一索引
- [x] 为 `standard_set.standard_set_code` 建唯一索引

### 3.1.3 初始化数据

- [x] 初始化 9 个标准阶段编码
- [x] 初始化一版专业主数据
- [x] 初始化一版定额集主数据
- [x] 预留江苏源系统字段：`source_field_code`, `source_markup`, `source_system`

验收标准：

- 能在空库完成一次迁移
- 初始化后可查询专业与定额集基础数据
- 唯一约束与外键约束全部生效

## 3.2 枚举与常量

- [x] 固化项目状态枚举：`draft`, `in_progress`, `under_review`, `archived`
- [x] 固化阶段状态枚举：`not_started`, `in_progress`, `pending_review`, `approved`, `completed`, `skipped`
- [x] 固化平台角色枚举
- [x] 固化业务身份枚举
- [x] 固化资源类型枚举：`project`, `stage`, `project_discipline`, `standard_set`
- [x] 固化操作类型枚举：`view`, `edit`, `submit`, `review`, `import`

验收标准：

- 枚举值与 [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md) 和 [permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 保持一致

## 3.3 鉴权与权限中间件

- [ ] 实现 JWT 鉴权
- [ ] 实现当前项目成员校验
- [ ] 实现平台角色校验
- [ ] 实现项目级资源权限校验
- [ ] 实现专业范围校验
- [ ] 实现项目专业配置写权限校验
- [ ] 实现定额集只读查询权限校验

验收标准：

- 非项目成员不能访问项目详情
- `project_owner` 可编辑阶段和专业配置
- `cost_engineer` 可查看专业配置和定额集，但不能修改项目专业配置

## 3.4 项目模块

### 3.4.1 接口任务

- [ ] 实现 `POST /api/v1/projects`
- [ ] 实现 `GET /api/v1/projects/{id}`
- [ ] 预留 `GET /api/v1/projects` 列表接口

### 3.4.2 业务规则

- [x] 创建项目时自动展开默认阶段模板
- [x] 创建项目时写入默认 `project_stage`
- [x] 创建项目时将负责人写入 `project_member`
- [x] 创建项目时支持绑定默认价目版本和默认取费模板

验收标准：

- 创建成功后可直接查询到项目详情
- 新项目至少带出一组有效阶段配置
- 项目负责人自动成为项目成员

## 3.5 阶段配置模块

### 3.5.1 接口任务

- [ ] 实现 `GET /api/v1/projects/{id}/stages`
- [ ] 实现 `PUT /api/v1/projects/{id}/stages`

### 3.5.2 规则任务

- [ ] 校验阶段编码不可重复
- [ ] 校验阶段顺序不可重复
- [ ] 校验启用阶段必须有合法顺序
- [ ] 校验负责人、审核人字段格式
- [ ] 校验禁用阶段不能排在已启用阶段中间造成断链

验收标准：

- 可对 9 个标准阶段做启用/停用配置
- 可调整阶段顺序
- 可为阶段配置负责人和审核人

## 3.6 项目成员与权限范围

### 3.6.1 数据层任务

- [ ] 完成 `project_member` 仓储
- [ ] 完成 `project_role_scope` 仓储

### 3.6.2 服务层任务

- [ ] 支持添加项目成员
- [ ] 支持移除或失活项目成员
- [ ] 支持配置系统角色
- [ ] 支持配置业务身份
- [ ] 支持配置阶段范围
- [ ] 支持配置专业范围
- [ ] 支持配置单体范围

### 3.6.3 接口建议

- [ ] 增加 `GET /api/v1/projects/{id}/members`
- [ ] 增加 `PUT /api/v1/projects/{id}/members`

验收标准：

- 一个成员可配置多个业务身份
- 一个成员可限定为仅能操作指定阶段和专业
- 审核人与编制人角色可分离配置

## 3.7 项目专业配置

### 3.7.1 接口任务

- [ ] 实现 `GET /api/v1/projects/{id}/disciplines`
- [x] 实现 `PUT /api/v1/projects/{id}/disciplines`
- [x] 实现 `GET /api/v1/standard-sets`

### 3.7.2 业务规则

- [x] 校验 `discipline_code` 必须存在于 `discipline_type`
- [x] 校验 `standard_set_code` 必须存在于 `standard_set`
- [x] 校验默认定额集与专业类型匹配
- [x] 支持项目专业排序
- [x] 支持项目专业启停

### 3.7.3 数据初始化与导入准备

- [ ] 导入江苏专业主数据样本
- [ ] 导入江苏定额集样本
- [x] 保留源字段：`source_field_code`, `source_markup`, `source_system`

验收标准：

- 项目下可启用多个专业
- 每个专业可绑定一个默认定额集
- 绑定不合法的定额集时返回 `422`

## 3.8 阶段工作台

### 3.8.1 接口任务

- [ ] 设计 `GET /api/v1/projects/{id}/workspace`
- [ ] 支持按 `stageCode` 查询当前阶段工作台

### 3.8.2 聚合内容

- [ ] 返回项目基础信息
- [ ] 返回阶段配置摘要
- [ ] 返回项目专业配置摘要
- [ ] 返回当前成员权限摘要
- [ ] 返回阶段状态与负责人信息
- [ ] 预留待办、风险、导入状态字段

建议返回结构：

- `project`
- `currentStage`
- `enabledStages`
- `disciplines`
- `memberScopes`
- `todoSummary`
- `riskSummary`

验收标准：

- 进入项目后可拿到当前阶段工作台基础信息
- 能看到当前项目启用了哪些专业和哪个默认定额集

## 3.9 源数据导入准备

这一部分 Iteration 1 不做正式导入功能，但要把后续导入所需的基础能力准备好。

### 3.9.1 元数据准备

- [x] 固化 `discipline_type` 的源字段结构
- [x] 固化 `standard_set` 的源字段结构
- [x] 确认 `source_system = xindian_jiangsu`
- [ ] 预留导入任务表或导入日志表设计

### 3.9.2 接口与权限准备

- [ ] 在权限中间件中预留 `import` 动作
- [x] 预留导入任务状态枚举
- [x] 预留导入错误响应结构

### 3.9.3 文档同步

- [ ] 同步 `backend-implementation-checklist.md`
- [ ] 同步 `openapi-v1.yaml` 的未来导入接口注释

验收标准：

- 后续做导入时不需要重构项目/专业/定额集主表
- 权限层已能识别 `import` 动作

## 4. 建议排期

### Day 1-2

- 数据库迁移
- 初始化数据
- 枚举与常量

### Day 3-4

- 项目创建与详情
- 阶段配置接口

### Day 5-6

- 项目成员与权限范围
- 项目专业配置
- 定额集查询

### Day 7

- 阶段工作台聚合接口
- 集成测试
- 文档回写

## 5. 联调顺序

建议按下面顺序联调：

1. 项目创建
2. 项目详情
3. 阶段配置读取与更新
4. 项目专业配置读取与更新
5. 定额集列表查询
6. 成员与权限配置
7. 阶段工作台

## 6. 风险点

- `project_stage` 与 `project_discipline` 都是项目配置表，前端容易把两者混成一个设置页
- 默认定额集绑定规则如果不做校验，后续清单和定额正式落地时会出现脏数据
- 项目成员权限若不先实现资源类型和操作类型枚举，后续清单模块会返工
- 如果现在不预留 `import` 权限，后面接源系统导入时会把权限模型打穿

## 7. 完成标准

Iteration 1 完成时，至少满足以下结果：

- 可以创建项目并查看详情
- 可以配置阶段顺序、负责人、审核人
- 可以配置项目成员、业务身份和基础范围权限
- 可以配置项目专业并绑定默认定额集
- 可以查询定额集列表
- 可以进入阶段工作台看到基础聚合信息
- 数据模型、OpenAPI、权限矩阵与实现口径一致
