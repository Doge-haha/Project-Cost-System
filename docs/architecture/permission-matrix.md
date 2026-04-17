# 新点 SaaS 造价系统 V1 权限矩阵

> 基于 [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)、[state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md) 与 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 整理。

## 1. 文档目标

本文档用于定义 V1 的权限控制模型，统一：

- 平台级菜单权限
- 项目级访问权限
- 阶段级操作权限
- 专业/单体范围权限
- 审核与编制分离规则

## 2. 权限设计原则

1. 平台角色决定“能不能进入某类模块”。
2. 项目成员配置决定“能不能进入某个项目”。
3. 阶段范围决定“能不能看/改/提/审某个阶段的数据”。
4. 专业与单体范围决定“能不能操作更细颗粒度的数据”。
5. 锁定状态高于编辑权限，锁定后即使有编辑权限也不能直接改。
6. 审核权限与编制权限必须隔离。

## 3. 平台级角色

| 角色编码 | 角色名称 | 说明 |
|---------|---------|------|
| `system_admin` | 系统管理员 | 平台级管理角色 |
| `project_owner` | 项目负责人 | 项目管理与协调角色 |
| `cost_engineer` | 造价员 | 清单、定额、过程单据处理角色 |
| `reviewer` | 审核员 | 负责审核阶段成果 |
| `review_analyst` | 复盘专员 | 负责项目复盘与指标提取 |

## 4. 业务身份

| 业务身份编码 | 名称 | 主要适用阶段 |
|-------------|------|-------------|
| `tender_cost_engineer` | 招标方造价员 | 招标清单、招标控制价 |
| `bid_cost_engineer` | 投标方造价员 | 投标报价 |
| `construction_budget_engineer` | 施工方预算员 | 合同清单、施工过程、竣工结算 |
| `audit_reviewer` | 审计方审核员 | 招标控制价审核、竣工结算审核 |

说明：

- 业务身份用于补充平台角色，不能单独替代平台角色。
- 一个项目成员可同时具备多个业务身份。

## 5. 权限粒度

### 5.1 资源类型

| 资源类型 | 说明 |
|---------|------|
| `project` | 项目主对象 |
| `stage` | 项目阶段配置 |
| `project_discipline` | 项目专业配置 |
| `bill` | 清单版本与清单项 |
| `bill_work_item` | 清单工作内容 |
| `quota` | 定额明细 |
| `standard_set` | 定额集主数据 |
| `report` | 报表与导出任务 |
| `summary` | 汇总分析 |
| `change_order` | 设计变更单 |
| `site_visa` | 现场签证单 |
| `progress_payment` | 进度款申报 |
| `audit_log` | 审计日志 |

### 5.2 操作类型

| 操作编码 | 含义 |
|---------|------|
| `view` | 查看 |
| `edit` | 编辑 |
| `submit` | 提交审核或提交审批 |
| `review` | 审核 |
| `export` | 导出 |
| `import` | 导入源数据 |
| `lock` | 锁定 |
| `unlock_request` | 发起解锁申请 |

## 6. 平台模块权限矩阵

| 模块 | system_admin | project_owner | cost_engineer | reviewer | review_analyst |
|------|--------------|---------------|---------------|----------|----------------|
| 系统设置 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 用户管理 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 基础库管理 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 专业配置 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 定额集管理 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 项目列表 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 项目详情 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 阶段配置 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 清单管理 | ✅ | ✅ | ✅ | 只读 | 只读 |
| 定额管理 | ✅ | ✅ | ✅ | 只读 | 只读 |
| 汇总分析 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 报表中心 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 审计日志 | ✅ | ✅ | 只读 | ✅ | ✅ |

## 7. 阶段级权限矩阵

### 7.1 投资估算 / 目标成本

| 角色 | view | edit | submit | review |
|------|------|------|--------|--------|
| project_owner | ✅ | ✅ | ✅ | ❌ |
| cost_engineer | ✅ | ✅ | ✅ | ❌ |
| reviewer | ✅ | ❌ | ❌ | ✅ |
| review_analyst | ✅ | ❌ | ❌ | ❌ |

### 7.2 招标清单 / 招标控制价 / 投标报价

| 角色 | view | edit | submit | review |
|------|------|------|--------|--------|
| project_owner | ✅ | ✅ | ✅ | ❌ |
| cost_engineer | ✅ | ✅ | ✅ | ❌ |
| reviewer | ✅ | ❌ | ❌ | ✅ |
| review_analyst | ✅ | ❌ | ❌ | ❌ |

补充规则：

- 招标清单阶段默认不允许编辑价格字段。
- 招标控制价在未开标前仅指定负责人和审核人可见。

### 7.3 合同清单 / 施工过程 / 竣工结算

| 角色 | view | edit | submit | review |
|------|------|------|--------|--------|
| project_owner | ✅ | ✅ | ✅ | ❌ |
| cost_engineer | ✅ | ✅ | ✅ | ❌ |
| reviewer | ✅ | ❌ | ❌ | ✅ |
| review_analyst | ✅ | ❌ | ❌ | ❌ |

补充规则：

- 合同清单锁定后，`edit` 仅对过程单据生效，不再对合同基线生效。
- 施工过程中的变更、签证、进度款需要对应阶段授权。

### 7.4 项目复盘

| 角色 | view | edit | submit | review |
|------|------|------|--------|--------|
| project_owner | ✅ | ✅ | ✅ | ❌ |
| cost_engineer | ✅ | ❌ | ❌ | ❌ |
| reviewer | ✅ | ❌ | ❌ | ✅ |
| review_analyst | ✅ | ✅ | ✅ | ❌ |

## 8. 资源级权限矩阵

### 8.1 清单资源 `bill`

| 操作 | project_owner | cost_engineer | reviewer | review_analyst |
|------|---------------|---------------|----------|----------------|
| 查看清单 | ✅ | ✅ | ✅ | ✅ |
| 新增清单项 | ✅ | ✅ | ❌ | ❌ |
| 编辑清单项 | ✅ | ✅ | ❌ | ❌ |
| 提交清单审核 | ✅ | ✅ | ❌ | ❌ |
| 审核清单 | ❌ | ❌ | ✅ | ❌ |
| 锁定版本 | ✅ | ❌ | ✅ | ❌ |
| 发起解锁申请 | ✅ | ✅ | ❌ | ❌ |

### 8.2 定额资源 `quota`

| 操作 | project_owner | cost_engineer | reviewer | review_analyst |
|------|---------------|---------------|----------|----------------|
| 查看定额明细 | ✅ | ✅ | ✅ | ✅ |
| 新增定额行 | ✅ | ✅ | ❌ | ❌ |
| 编辑含量/价目 | ✅ | ✅ | ❌ | ❌ |
| 执行套用校验 | ✅ | ✅ | ✅ | ❌ |
| 审核定额结果 | ❌ | ❌ | ✅ | ❌ |

### 8.3 项目专业配置 `project_discipline`

| 操作 | project_owner | cost_engineer | reviewer | review_analyst |
|------|---------------|---------------|----------|----------------|
| 查看项目专业配置 | ✅ | ✅ | ✅ | ✅ |
| 编辑项目专业配置 | ✅ | ❌ | ❌ | ❌ |
| 绑定默认定额集 | ✅ | ❌ | ❌ | ❌ |

### 8.4 定额集主数据 `standard_set`

| 操作 | project_owner | cost_engineer | reviewer | review_analyst |
|------|---------------|---------------|----------|----------------|
| 查看定额集 | ✅ | ✅ | ✅ | ✅ |
| 维护定额集主数据 | ✅ | ❌ | ❌ | ❌ |
| 导入定额集 | ✅ | ❌ | ❌ | ❌ |

### 8.5 清单工作内容 `bill_work_item`

| 操作 | project_owner | cost_engineer | reviewer | review_analyst |
|------|---------------|---------------|----------|----------------|
| 查看工作内容 | ✅ | ✅ | ✅ | ✅ |
| 新增工作内容 | ✅ | ✅ | ❌ | ❌ |
| 编辑工作内容 | ✅ | ✅ | ❌ | ❌ |
| 导入工作内容 | ✅ | ✅ | ❌ | ❌ |

### 8.6 汇总与报表 `summary` / `report`

| 操作 | project_owner | cost_engineer | reviewer | review_analyst |
|------|---------------|---------------|----------|----------------|
| 查看汇总 | ✅ | ✅ | ✅ | ✅ |
| 导出报表 | ✅ | ✅ | ✅ | ✅ |
| 查看偏差分析 | ✅ | ✅ | ✅ | ✅ |
| 生成复盘指标 | ✅ | ❌ | ✅ | ✅ |

### 8.7 过程单据

| 资源 | 操作 | project_owner | cost_engineer | reviewer | review_analyst |
|------|------|---------------|---------------|----------|----------------|
| change_order | 新建/编辑/提交 | ✅ | ✅ | ❌ | ❌ |
| change_order | 审核 | ❌ | ❌ | ✅ | ❌ |
| site_visa | 新建/编辑/提交 | ✅ | ✅ | ❌ | ❌ |
| site_visa | 审核 | ❌ | ❌ | ✅ | ❌ |
| progress_payment | 新建/编辑/提交 | ✅ | ✅ | ❌ | ❌ |
| progress_payment | 审核 | ❌ | ❌ | ✅ | ❌ |

### 8.8 源数据导入

| 资源 | 操作 | project_owner | cost_engineer | reviewer | review_analyst |
|------|------|---------------|---------------|----------|----------------|
| bill | 导入源清单 | ✅ | ✅ | ❌ | ❌ |
| bill_work_item | 导入源工作内容 | ✅ | ✅ | ❌ | ❌ |
| quota | 导入源定额 | ✅ | ✅ | ❌ | ❌ |
| standard_set | 导入定额集 | ✅ | ❌ | ❌ | ❌ |

## 9. 专业与单体范围控制

项目成员在项目内的实际可操作范围，还要受专业和单体范围限制。

### 9.1 范围规则

| 场景 | 规则 |
|------|------|
| 未配置专业范围 | 默认可见全部专业 |
| 配置了专业范围 | 仅能操作授权专业 |
| 未配置单体范围 | 默认可见该专业下全部单体 |
| 配置了单体范围 | 仅能操作授权单体 |

### 9.2 示例

| 用户 | 阶段 | 专业 | 单体 | 可操作 |
|------|------|------|------|--------|
| 张工 | 招投标 | 土建 | 1#楼 | 土建1#楼清单、定额、汇总 |
| 王工 | 施工过程 | 安装 | 2#楼机电 | 2#楼机电变更、签证、计量 |
| 赵工 | 竣工结算 | 全部 | 全部 | 只读全部，审核结算 |

## 10. 审编分离规则

必须执行以下规则：

1. 同一资源的提交人与审核人不能是同一人。
2. 同一阶段内，若某用户拥有 `submit` 权限，则对同一资源不得拥有 `review` 权限。
3. 审核人可查看修改记录，但不能在审核页面直接替代编制人修改业务数据。

## 11. 锁定优先级规则

锁定状态优先级高于编辑权限。

| 场景 | 结果 |
|------|------|
| 用户有 `edit` 权限，但版本已锁定 | 不允许直接编辑 |
| 用户有 `review` 权限，版本已锁定 | 可审核、可查看，不可改内容 |
| 用户有 `unlock_request` 权限，版本已锁定 | 可发起解锁申请 |
| 用户有 `edit bill_work_item` 权限，但父清单行已锁定 | 不允许编辑工作内容 |

## 12. 接口权限映射建议

| 接口 | 最低权限要求 |
|------|-------------|
| `POST /api/v1/projects` | 平台角色 `project_owner` 或 `system_admin` |
| `PUT /api/v1/projects/{id}/stages` | 项目级 `stage:edit` |
| `GET /api/v1/projects/{id}/disciplines` | 项目级 `project_discipline:view` |
| `PUT /api/v1/projects/{id}/disciplines` | 项目级 `project_discipline:edit` |
| `GET /api/v1/standard-sets` | 平台模块 `基础库管理` 或项目内只读权限 |
| `POST /api/v1/projects/{id}/bill-items` | 当前阶段 `bill:edit` |
| `PUT /api/v1/projects/{id}/bill-items/{itemId}` | 当前阶段 `bill:edit` 且未锁定 |
| `GET /api/v1/projects/{id}/bill-items/{itemId}/work-items` | 当前阶段 `bill_work_item:view` |
| `POST /api/v1/projects/{id}/bill-items/{itemId}/work-items` | 当前阶段 `bill_work_item:edit` 且父清单未锁定 |
| `PUT /api/v1/projects/{id}/bill-items/{itemId}/work-items/{workItemId}` | 当前阶段 `bill_work_item:edit` 且父清单未锁定 |
| `POST /api/v1/projects/{id}/quota-lines` | 当前阶段 `quota:edit` |
| `POST /api/v1/projects/{id}/review-submissions` | 当前阶段 `submit` |
| 审核类接口 | 当前阶段 `review` |
| `POST /api/v1/reports/export` | 当前项目 `report:export` |

## 13. 前端控制建议

### 13.1 按钮显隐

| 按钮 | 条件 |
|------|------|
| 添加清单 | `bill:edit` 且当前版本未锁定 |
| 编辑清单 | `bill:edit` 且当前版本未锁定 |
| 添加工作内容 | `bill_work_item:edit` 且父清单未锁定 |
| 编辑工作内容 | `bill_work_item:edit` 且父清单未锁定 |
| 提交审核 | `submit` 且当前阶段为 `in_progress` |
| 审核通过/驳回 | `review` 且当前阶段为 `pending_review` |
| 锁定 | `lock` 且当前版本为 `approved` |
| 导出报表 | `report:export` |
| 绑定默认定额集 | `project_discipline:edit` |

### 13.2 页面只读态

以下场景页面应整体只读：

- 当前阶段处于 `pending_review`
- 当前版本为 `locked`
- 项目为 `archived`
- 用户仅有 `view` 权限

## 14. 推荐落库方式

建议通过 `project_member + project_role_scope` 实现项目内权限。

### 14.1 `project_member`

- 存平台角色
- 存业务身份
- 存成员是否有效

### 14.2 `project_role_scope`

- 存阶段编码
- 存专业范围
- 存单体范围
- 存资源类型
- 存操作类型

推荐新增资源编码：

- `project_discipline`
- `bill_work_item`
- `standard_set`

## 15. 下一步建议

现在开发前的五件套已经基本齐了：

1. 设计稿
2. 数据模型
3. 状态机
4. OpenAPI
5. 权限矩阵

如果你要真正开工，下一步最值钱的是两件事：

1. 基于这版权限矩阵把接口权限中间件枚举固化下来
2. 把导入能力拆成单独的 `import` 权限和后台任务清单
