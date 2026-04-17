# 新点 SaaS 造价系统 V1 状态机

> 基于 [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md)、[2026-04-16-saas-pricing-v1-implementation.md](/Users/huahaha/Documents/New%20project/docs/superpowers/plans/2026-04-16-saas-pricing-v1-implementation.md) 与 [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md) 整理。

## 1. 文档目标

本文档用于定义 V1 各核心对象的状态流转规则，统一以下实现口径：

- 后端状态字段与校验逻辑
- 前端页面按钮显示与禁用规则
- 审核流和锁定流
- 版本提交与驳回机制
- 报表与异步任务状态反馈

## 2. 状态机设计原则

1. 每个核心对象只允许存在一套主状态，不允许同一个流程被多个字段重复表达。
2. 状态变化必须由明确事件触发，不允许隐式跳转。
3. 被驳回后原则上回到最近可编辑状态，而不是生成新的“半状态”。
4. 合同基线类对象的锁定状态独立于编辑状态，但必须和版本状态联动。
5. 所有状态切换都必须写入审计日志。

## 3. 项目状态机

### 3.1 状态定义

| 状态 | 含义 |
|------|------|
| `draft` | 项目已创建，但尚未正式启动阶段执行 |
| `in_progress` | 至少一个已启用阶段进入执行 |
| `under_review` | 当前活动阶段已提交审核 |
| `archived` | 项目已完成或归档，不参与日常编辑 |

### 3.2 状态流转

```text
draft -> in_progress -> under_review -> in_progress
                     -> archived
```

### 3.3 触发事件

| 事件 | 当前状态 | 下一状态 | 说明 |
|------|---------|---------|------|
| 项目创建完成 | - | `draft` | 创建项目后默认进入草稿态 |
| 启动首个阶段 | `draft` | `in_progress` | 当首个启用阶段开始执行 |
| 当前阶段提交审核 | `in_progress` | `under_review` | 当前阶段进入待审 |
| 审核驳回 | `under_review` | `in_progress` | 返回执行中 |
| 审核通过但项目未结束 | `under_review` | `in_progress` | 进入下一阶段或继续当前项目 |
| 项目归档 | `draft` / `in_progress` / `under_review` | `archived` | 手工归档或项目完成归档 |

### 3.4 页面控制规则

- `draft` 时允许编辑项目基础信息和阶段配置。
- `in_progress` 时允许进入阶段工作台、编辑当前阶段数据。
- `under_review` 时默认禁止继续修改当前提交对象。
- `archived` 时默认全项目只读，仅允许查看和导出。

## 4. 阶段状态机

### 4.1 状态定义

| 状态 | 含义 |
|------|------|
| `not_started` | 阶段已配置但尚未进入执行 |
| `in_progress` | 阶段正在执行 |
| `pending_review` | 阶段成果已提交审核 |
| `approved` | 审核通过，但尚未执行阶段结束动作 |
| `completed` | 阶段已结束，并已完成流转或归档 |
| `skipped` | 阶段在项目配置中被跳过或明确关闭 |

### 4.2 状态流转

```text
not_started -> in_progress -> pending_review -> approved -> completed
                                 \-> in_progress
not_started -> skipped
```

### 4.3 触发事件

| 事件 | 当前状态 | 下一状态 | 说明 |
|------|---------|---------|------|
| 启动阶段 | `not_started` | `in_progress` | 负责人开始处理 |
| 提交阶段审核 | `in_progress` | `pending_review` | 当前阶段成果提交 |
| 审核驳回 | `pending_review` | `in_progress` | 回退继续修改 |
| 审核通过 | `pending_review` | `approved` | 阶段结果审核通过 |
| 执行完成动作 | `approved` | `completed` | 自动下一阶段或人工确认后完成 |
| 跳过阶段 | `not_started` | `skipped` | 项目配置明确跳过 |

### 4.4 限制规则

- 非当前活动阶段默认不可编辑。
- `pending_review` 状态下，当前阶段默认只读。
- `approved` 到 `completed` 之间不允许再编辑业务数据，只允许执行流转动作。
- `skipped` 状态不能再进入 `in_progress`，除非重新编辑项目阶段配置。

## 5. 清单版本状态机

### 5.1 状态定义

| 状态 | 含义 |
|------|------|
| `editable` | 当前版本可编辑 |
| `submitted` | 当前版本已提交审核 |
| `approved` | 当前版本审核通过 |
| `locked` | 当前版本锁定，不允许直接修改 |
| `rejected` | 当前版本审核驳回 |

### 5.2 状态流转

```text
editable -> submitted -> approved -> locked
   ^           |
   |           v
   +------ rejected
```

### 5.3 触发事件

| 事件 | 当前状态 | 下一状态 | 说明 |
|------|---------|---------|------|
| 新建版本 | - | `editable` | 导入、引用、复制或新建版本 |
| 提交审核 | `editable` | `submitted` | 发起审核 |
| 审核驳回 | `submitted` | `rejected` | 驳回 |
| 重新打开编辑 | `rejected` | `editable` | 按驳回意见继续修改 |
| 审核通过 | `submitted` | `approved` | 审核通过 |
| 锁定版本 | `approved` | `locked` | 合同基线、已通过版本锁定 |

### 5.4 限制规则

- `locked` 状态下不允许直接增删改清单项。
- 若后续阶段需要调整，必须新建变更版本或过程单据。
- `approved` 状态默认只读，但允许执行锁定动作。
- `rejected` 状态保留驳回意见，不得丢失原提交流程记录。

## 6. 清单行锁定状态机

### 6.1 状态定义

| 状态 | 含义 |
|------|------|
| `unlocked` | 可编辑 |
| `lock_requested` | 已提交锁定申请，待审批 |
| `locked` | 已锁定，只读 |
| `unlock_requested` | 已提交解锁申请，待审批 |

### 6.2 状态流转

```text
unlocked -> lock_requested -> locked -> unlock_requested -> unlocked
```

### 6.3 触发事件

| 事件 | 当前状态 | 下一状态 | 说明 |
|------|---------|---------|------|
| 发起锁定申请 | `unlocked` | `lock_requested` | 申请锁定 |
| 锁定审批通过 | `lock_requested` | `locked` | 锁定生效 |
| 发起解锁申请 | `locked` | `unlock_requested` | 申请解锁 |
| 解锁审批通过 | `unlock_requested` | `unlocked` | 恢复可编辑 |

### 6.4 限制规则

- 合同清单基线默认应在通过审核后整体进入 `locked`。
- 解锁必须保留申请原因和审批记录。
- 锁定状态变化必须同步影响前端按钮可用性。

## 7. 审核记录状态机

### 7.1 状态定义

| 状态 | 含义 |
|------|------|
| `pending` | 待审核 |
| `approved` | 审核通过 |
| `rejected` | 审核驳回 |
| `cancelled` | 提交被撤销或失效 |

### 7.2 状态流转

```text
pending -> approved
pending -> rejected
pending -> cancelled
```

### 7.3 触发事件

| 事件 | 当前状态 | 下一状态 | 说明 |
|------|---------|---------|------|
| 创建审核提交 | - | `pending` | 用户提交审核 |
| 审核通过 | `pending` | `approved` | 审核通过 |
| 审核驳回 | `pending` | `rejected` | 审核驳回 |
| 撤销提交 | `pending` | `cancelled` | 在未审核前撤回 |

### 7.4 限制规则

- 同一资源在存在 `pending` 记录时，不应重复创建新的提交记录。
- 审核通过或驳回后，不允许再次修改该条审核记录，只能新建下一次提交流程。

## 8. 过程单据状态机

本节适用于 `change_order`、`site_visa`、`progress_payment` 等过程单据。

### 8.1 状态定义

| 状态 | 含义 |
|------|------|
| `draft` | 草稿 |
| `pending` | 待审批 |
| `approved` | 审批通过 |
| `rejected` | 审批驳回 |
| `settled` | 已计入结算或已关闭 |

### 8.2 状态流转

```text
draft -> pending -> approved -> settled
              \-> rejected -> draft
```

### 8.3 规则

- 只有 `approved` 的过程单据才能影响清单版本、汇总和结算金额。
- `rejected` 后允许回退到 `draft` 重新编辑。
- `settled` 后不允许继续编辑金额类字段。

## 9. 报表任务状态机

### 9.1 状态定义

| 状态 | 含义 |
|------|------|
| `queued` | 已创建任务，等待执行 |
| `processing` | 正在生成 |
| `completed` | 已完成，可下载 |
| `failed` | 生成失败 |

### 9.2 状态流转

```text
queued -> processing -> completed
                   \-> failed
```

### 9.3 规则

- 导出类任务默认使用异步处理。
- `failed` 状态需保留错误原因并支持重新发起。
- 前端轮询或订阅任务状态时，只读查询，不应改写任务状态。

## 10. AI 推荐状态机

### 10.1 状态定义

| 状态 | 含义 |
|------|------|
| `generated` | 推荐已生成 |
| `accepted` | 用户接受推荐 |
| `ignored` | 用户忽略推荐 |
| `expired` | 推荐因版本变化失效 |

### 10.2 状态流转

```text
generated -> accepted
generated -> ignored
generated -> expired
```

### 10.3 规则

- 推荐结果只能辅助，不直接推动主业务对象状态变化。
- 若源清单版本或定额上下文发生变化，旧推荐应进入 `expired`。

## 11. 状态联动规则

### 11.1 项目与阶段联动

- 任一活动阶段进入 `pending_review`，项目可进入 `under_review`。
- 当前活动阶段完成后，项目恢复 `in_progress` 或进入 `archived`。

### 11.2 阶段与清单版本联动

- 阶段进入 `pending_review` 前，至少应存在一个当前阶段主清单版本。
- 清单版本处于 `submitted` 时，阶段应同步进入 `pending_review`。
- 清单版本审核驳回后，阶段回退到 `in_progress`。

### 11.3 锁定与过程单据联动

- 合同清单整体锁定后，过程单据成为后续造价调整唯一入口。
- 过程单据审批通过后，触发清单变更版本或汇总重算。

## 12. 前端控制建议

### 12.1 按钮显隐逻辑

| 按钮 | 显示条件 |
|------|---------|
| `提交审核` | 当前阶段为 `in_progress` 且用户有 `submit` 权限 |
| `审核通过/驳回` | 当前阶段为 `pending_review` 且用户有 `review` 权限 |
| `锁定` | 清单版本为 `approved` 且用户有审批权限 |
| `解锁申请` | 清单版本为 `locked` 且用户有解锁申请权限 |
| `编辑` | 当前对象处于可编辑状态且未锁定 |

### 12.2 页面提醒逻辑

- `pending_review`：页面显示黄色审核提醒
- `locked`：页面显示灰色锁定标记并禁用编辑入口
- `rejected`：页面显示红色驳回原因提示
- `failed`：任务或计算失败时显示错误提示并支持重试

## 13. 审计要求

以下状态切换必须写入 `audit_log`：

- 项目归档
- 阶段启动、提交、通过、驳回、完成
- 清单版本提交、通过、驳回、锁定、解锁
- 过程单据审批通过、驳回、结转
- 报表任务失败

## 14. 下一步建议

在本文档基础上，建议继续补：

1. `docs/api/openapi-v1.yaml`
2. `docs/architecture/permission-matrix.md`

这样就能把状态控制、接口契约和权限控制三部分一起闭环。 
