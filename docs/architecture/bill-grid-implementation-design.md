# 新点 SaaS 造价系统清单表格引擎详细设计

> 基于 [设计文档_v1.0_优化中.md](/Users/huahaha/Documents/New%20project/设计文档_v1.0_优化中.md)、[technical-architecture-and-platform-selection.md](/Users/huahaha/Documents/New%20project/docs/architecture/technical-architecture-and-platform-selection.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md) 与 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 展开。

## 1. 文档目标

这份文档用于把“工程量清单表格的实现方式”从页面说明推进到开发级设计。

它重点回答 8 个问题：

- 清单表格在系统里到底是什么角色
- 清单树与工作内容如何组织
- 列模型怎么设计
- 编辑、保存、校验、锁定怎么实现
- 前后端 patch 协议怎么设计
- 版本来源与差异提示怎么展示
- 大数据量下的性能策略是什么
- V1 与后续增强的边界在哪里

## 2. 设计定位

## 2.1 清单表格不是普通表格组件

清单表格本质上是：

- 领域对象编辑器
- 树结构数据视图
- 状态机承载界面
- 版本来源可视化载体
- 定额与计价的上游入口

它不是一个简单的“列表 CRUD 页”，而是系统最核心的生产界面之一。

## 2.2 清单表格引擎的职责边界

清单表格引擎负责：

- 渲染清单树
- 管理列配置
- 提供单元格编辑能力
- 管理本地脏数据
- 展示锁定、来源、校验状态
- 触发批量 patch 保存
- 和工作内容、定额、来源链联动

清单表格引擎不负责：

- 直接成为数据库
- 执行计价公式
- 代替工作流引擎
- 管理流程表单

## 2.3 推荐实现方式

推荐：

- 前端基于 `AG Grid Enterprise`
- 后端坚持 `bill_version + bill_item + bill_item_work_item` 规范化存储
- 保存协议采用“局部 patch + 批量提交”

## 3. 数据模型与视图模型关系

## 3.1 存储模型

清单主数据仍然存储在：

- `bill_version`
- `bill_item`
- `bill_item_work_item`

其中：

- `bill_version` 表示一份版本
- `bill_item` 表示一条清单树节点
- `bill_item_work_item` 表示该清单项下的工作内容子项

## 3.2 视图模型

前端不直接绑定数据库表，而是使用 Grid Row ViewModel。

建议结构：

```ts
type BillGridRow = {
  id: string
  versionId: string
  parentId: string | null
  rowType: 'chapter' | 'section' | 'item'
  level: number
  sortOrder: number
  itemCode: string | null
  itemName: string
  unit: string | null
  quantity: number | null
  systemUnitPrice: number | null
  manualUnitPrice: number | null
  finalUnitPrice: number | null
  amount: number | null
  taxRate: number | null
  featureDesc: string | null
  sourceVersionLabel: string | null
  sourceBillId: string | null
  sourceLevelCode: string | null
  lockStatus: 'unlocked' | 'lock_requested' | 'locked' | 'unlock_requested'
  validationStatus: 'normal' | 'warning' | 'error'
  hasChildren: boolean
  workItemCount: number
  isDirty: boolean
  isReadonly: boolean
}
```

### 原则

- ViewModel 可以冗余展示字段
- 但不能替代存储模型
- 不能把整棵树直接长期存成前端 JSON 真相

## 4. 树结构设计

## 4.1 节点类型

V1 建议支持三类节点：

- `chapter`
- `section`
- `item`

其中：

- `chapter` 和 `section` 主要承担层级与汇总展示
- `item` 才是真正计价对象

## 4.2 树关系字段

后端建议使用：

- `id`
- `parent_id`
- `level_no`
- `sort_order`
- `source_level_code`

### 约束原则

- 同一版本内不允许跨版本挂父节点
- 同一父节点下 `sort_order` 必须稳定
- 不允许形成循环父子关系

## 4.3 树渲染策略

前端建议：

- AG Grid Tree Data 模式
- 只展开当前需要看的层级
- 默认展开到 `section`，清单项按需展开

### 为什么不建议一次性全展开

因为清单体量可能很大，全展开会导致：

- 初始渲染慢
- 虚拟滚动收益下降
- 用户定位效率下降

## 5. 列模型设计

## 5.1 列分组建议

建议把列分成 6 组：

1. 结构列
2. 基础业务列
3. 价格列
4. 来源与状态列
5. 关联列
6. 辅助列

## 5.2 结构列

- `select`
- `tree_toggle`
- `row_no`
- `level`

用途：

- 选择
- 展开/折叠
- 层级识别
- 行级批量操作

## 5.3 基础业务列

- `item_code`
- `item_name`
- `unit`
- `quantity`
- `feature_desc`
- `remark`

这些列是清单编辑核心区。

## 5.4 价格列

建议至少显示：

- `system_unit_price`
- `manual_unit_price`
- `final_unit_price`
- `amount`
- `tax_rate`

### 说明

即使在招标阶段部分列不可编辑，也建议保留显示位，避免不同阶段页面结构漂移太大。

## 5.5 来源与状态列

- `source_version_label`
- `lock_status`
- `validation_status`
- `source_bill_id`

这些列主要服务：

- 追溯
- 锁定判断
- 差异识别
- 审核前检查

## 5.6 关联列

- `work_item_count`
- `quota_line_count`
- `linked_document_count`

V1 可以先展示前两项，单据关联数量可后补。

## 5.7 列配置能力

V1 就建议支持：

- 列显隐
- 列宽调整
- 列顺序调整
- 冻结列

推荐把用户配置持久化到：

- `user_grid_preference`

或者暂存在前端本地存储，V1 可先做本地方案。

## 6. 编辑模型设计

## 6.1 编辑粒度

推荐：

- 单元格级编辑
- 行级校验
- 批量 patch 保存

不建议：

- 每个单元格失焦即实时直写数据库
- 整棵树一次性全量提交

## 6.2 本地脏数据模型

前端建议维护：

- `dirtyRows`
- `dirtyCells`
- `pendingOperations`

### `pendingOperations` 建议类型

- `create_row`
- `update_row`
- `delete_row`
- `move_row`
- `batch_update`

## 6.3 保存时机

推荐支持三种保存方式：

- 手动点击保存
- 快捷键 `Ctrl+S`
- 离开页面前提醒

V1 不建议做完全自动保存。

## 6.4 编辑权限控制

单元格是否可编辑，需要综合判断：

1. 当前阶段规则
2. 当前版本锁定状态
3. 当前审核状态
4. 用户权限
5. 字段来源属性

例如：

- `source_version_label` 永远只读
- 合同清单锁定后 `item_name`、`quantity`、`unit` 只读
- `reviewer` 永远只读

## 7. Patch 协议设计

## 7.1 为什么必须做 patch

清单表格有两个特点：

- 行数多
- 修改往往是局部的

如果每次保存都整表提交，会造成：

- 网络负担大
- 冲突处理难
- 后端更新代价高

所以必须采用 patch 协议。

## 7.2 推荐请求模型

建议新增批量接口：

- `POST /api/v1/projects/{id}/bill-items/batch`

请求结构建议：

```json
{
  "versionId": "uuid",
  "operations": [
    {
      "op": "update",
      "itemId": "uuid",
      "fields": {
        "itemName": "挖沟槽土方",
        "quantity": 120.5
      }
    },
    {
      "op": "create",
      "parentId": "uuid",
      "afterItemId": "uuid",
      "payload": {
        "rowType": "item",
        "itemCode": "010101001001",
        "itemName": "平整场地",
        "unit": "m2",
        "quantity": 1000
      }
    }
  ]
}
```

## 7.3 支持的操作类型

V1 建议支持：

- `create`
- `update`
- `delete`
- `move`

### 额外建议

`move` 应明确：

- `parentId`
- `beforeItemId` 或 `afterItemId`

避免仅传 `sortOrder` 造成并发混乱。

## 7.4 返回结构建议

建议返回：

- 成功应用的操作列表
- 失败的操作及原因
- 更新后的关键字段
- 新行真实 ID

例如：

```json
{
  "successCount": 2,
  "failureCount": 1,
  "results": [
    {
      "opIndex": 0,
      "status": "success",
      "itemId": "uuid"
    },
    {
      "opIndex": 2,
      "status": "failure",
      "code": "LOCKED",
      "message": "当前版本已锁定"
    }
  ]
}
```

## 8. 校验与错误提示设计

## 8.1 校验分层

建议分 3 层校验：

### 前端即时校验

- 必填
- 数字格式
- 字符长度
- 基础编码格式

### 后端保存校验

- 同级编号重复
- 父子关系非法
- 锁定状态不可改
- 来源字段不可覆盖

### 提交前业务校验

- 项目特征缺失
- 必须绑定过程单据
- 差异说明缺失
- 必需定额缺失

## 8.2 错误反馈方式

建议同时提供：

- 单元格红框
- 行级状态色
- 顶部汇总错误数
- 底部状态栏详情

## 8.3 校验状态字段

V1 推荐统一使用：

- `normal`
- `warning`
- `error`

颜色建议：

- `normal` 绿色/默认
- `warning` 黄色
- `error` 红色

## 9. 锁定、审核与来源链展示

## 9.1 锁定态展示

锁定态必须在表格中非常明显。

建议：

- 行背景灰化
- 锁图标
- 编辑器禁用
- 顶部提示“当前版本已锁定”

## 9.2 审核中展示

审核中建议：

- 页面顶部黄色提示条
- 行编辑入口禁用
- 显示当前审核状态与审核人

## 9.3 来源链展示

来源链不要塞进主单元格里显示全部信息，建议：

- 主列中只显示来源版本标签
- hover 看摘要
- 点击打开右侧来源链侧栏

侧栏建议展示：

- 当前版本
- 上游版本
- 生成方式
- 变更原因
- 关联单据

## 10. 工作内容子表设计

## 10.1 展开方式

建议工作内容采用“行下展开区”，不要单独再开一个完全独立页面。

触发方式可选：

- 行展开
- 右侧详情侧栏

V1 推荐：

- 主体用行展开区
- 辅助说明放右侧栏

## 10.2 编辑模式

工作内容也建议采用：

- 局部 patch
- 排序稳定
- 锁定继承父清单项状态

## 10.3 与清单项联动规则

- 父清单锁定时，工作内容只读
- 父清单删除前必须先处理工作内容
- 工作内容数量变化应实时更新 `work_item_count`

## 11. 性能设计

## 11.1 前端性能

推荐策略：

- 虚拟滚动
- 树节点懒展开
- 局部刷新单元格
- 避免每次编辑全表 re-render

### 特别注意

- 不要把整个 grid 数据无脑放进全局状态每次整体替换
- 每次 patch 返回后只更新受影响行

## 11.2 后端性能

推荐策略：

- 按版本 ID 查询
- 对 `bill_version_id`、`parent_id`、`sort_order` 建索引
- 批量 patch 合并事务
- 导入和批量重算与主表编辑隔离

## 11.3 并发控制

V1 推荐先做“乐观锁 + 版本号”。

建议字段：

- `row_version`

更新时带上：

- 当前 `row_version`

冲突时返回：

- `409 CONFLICT`

并提示用户：

- 行已被他人修改
- 是否刷新后重试

## 12. 阶段差异实现策略

## 12.1 不同阶段同一套 Grid

推荐不要为招标、投标、合同、变更、结算分别写 5 套表格页面。

应该坚持：

- 同一套 grid
- 不同阶段切列权限和编辑规则

## 12.2 阶段规则来源

建议前端读取：

- `stageCode`
- `versionType`
- `lockStatus`
- 用户权限

生成最终列权限。

例如：

- 招标阶段隐藏人工调价入口
- 合同基线阶段禁止结构修改
- 施工变更阶段要求关联变更单

## 13. 推荐接口补充

除了已有接口，建议补这几类：

- `POST /api/v1/projects/{id}/bill-items/batch`
- `POST /api/v1/projects/{id}/bill-items/reorder`
- `POST /api/v1/projects/{id}/bill-items/{itemId}/duplicate`
- `GET /api/v1/projects/{id}/bill-items/{itemId}/source-chain`
- `POST /api/v1/projects/{id}/bill-items/validate`

## 14. V1 与 V1.1 边界

## 14.1 V1 必做

- 树形 grid
- 基础列模型
- 单元格编辑
- 批量 patch 保存
- 锁定态与审核态只读
- 工作内容展开区
- 来源链摘要
- 基础校验与错误高亮

## 14.2 V1.1 再做

- Excel 式跨行批量粘贴增强
- 自定义公式列
- 多人协同光标提示
- 更复杂的列视图模板
- 差异对比双栏视图

## 15. 一句话结论

清单表格在本项目中应被设计成：

`基于 AG Grid 的领域专用树表格引擎，以规范化业务表存储为真相来源，通过批量 patch、锁定控制、来源链展示和性能优化来支撑全过程造价清单主链。`

