# 新点 SaaS 造价系统 Iteration 3 任务拆分

> 基于 [2026-04-16-saas-pricing-v1-implementation.md](/Users/huahaha/Documents/New%20project/docs/superpowers/plans/2026-04-16-saas-pricing-v1-implementation.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)、[permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md)、[state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md) 与 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 整理。

## 1. 迭代目标

Iteration 3 的目标，是在清单与版本链已经建立的基础上，把“定额、价目、取费、计价引擎”真正接入业务主链，让系统具备受控计价和重算能力。

本迭代重点覆盖：

- `quota_line`
- `price_version`、`price_item`
- `fee_template`、`fee_rule`
- 定额套用与校验
- 价目版本绑定
- 取费模板绑定
- 单项计价与批量重算
- 系统值、人工值、最终值并存

本迭代不要求完成：

- 汇总报表
- 审核流完整闭环
- 过程单据联动结算
- AI 推荐

## 2. 交付范围

### 2.1 后端交付

- `quota_line`
- `price_version`
- `price_item`
- `fee_template`
- `fee_rule`
- 定额套用服务
- 计价引擎服务
- 批量重算服务

### 2.2 前端交付

- 定额管理页
- 定额选择器
- 价目版本切换入口
- 取费模板配置入口
- 计价结果展示区
- 人工调价入口

### 2.3 测试交付

- 定额套用单元测试
- 价目命中测试
- 取费命中测试
- 计价引擎集成测试
- 重算流程测试

## 3. 任务拆分

## 3.1 数据库与迁移

### 3.1.1 建表任务

- [ ] 创建 `quota_line`
- [ ] 创建 `price_version`
- [ ] 创建 `price_item`
- [ ] 创建 `fee_template`
- [ ] 创建 `fee_rule`

### 3.1.2 字段补齐

- [ ] `quota_line` 加入 `source_standard_set_code`
- [ ] `quota_line` 加入 `source_quota_id`
- [ ] `quota_line` 加入 `source_sequence`
- [ ] `quota_line` 加入 `chapter_code`
- [ ] `quota_line` 加入 `labor_fee`
- [ ] `quota_line` 加入 `material_fee`
- [ ] `quota_line` 加入 `machine_fee`
- [ ] `quota_line` 加入 `content_factor`
- [ ] `quota_line` 加入 `source_mode`
- [ ] `price_item` 加入 `labor_unit_price`
- [ ] `price_item` 加入 `material_unit_price`
- [ ] `price_item` 加入 `machine_unit_price`
- [ ] `price_item` 加入 `total_unit_price`

### 3.1.3 索引与约束

- [ ] 为 `quota_line(bill_item_id, quota_code)` 建索引
- [x] 为 `price_version.version_code` 建唯一索引
- [x] 为 `price_item(price_version_id, quota_code)` 建唯一索引
- [ ] 为 `fee_rule(fee_template_id, fee_type, discipline_code)` 建业务索引

验收标准：

- 定额、价目、取费相关表可完整迁移
- 一个清单项可挂多条定额
- 一个价目版本内定额编号不可重复

## 3.2 枚举与常量

- [x] 固化定额来源方式枚举：`manual`, `ai`, `history_reference`, `reference_knowledge`
- [x] 固化价目版本状态枚举：`draft`, `active`, `inactive`
- [x] 固化取费模板状态枚举：`draft`, `active`, `inactive`
- [x] 固化计价字段口径：`system_*`, `manual_*`, `final_*`
- [x] 固化定额校验状态枚举：`normal`, `warning`, `error`

验收标准：

- 枚举值与数据模型和 OpenAPI 保持一致

## 3.3 定额管理模块

### 3.3.1 接口任务

- [ ] 实现 `GET /api/v1/projects/{id}/quota-lines`
- [ ] 实现 `POST /api/v1/projects/{id}/quota-lines`
- [ ] 实现 `PUT /api/v1/projects/{id}/quota-lines/{lineId}`

### 3.3.2 建议新增接口

- [ ] 增加 `POST /api/v1/projects/{id}/quota-lines/batch-create`
- [ ] 增加 `POST /api/v1/projects/{id}/quota-lines/validate`
- [ ] 增加 `GET /api/v1/projects/{id}/quota-lines/source-chain`

### 3.3.3 业务规则

- [ ] 定额明细必须归属有效清单项
- [ ] 锁定版本下禁止新增或编辑定额
- [ ] 支持一个清单项关联多条定额
- [ ] 支持修改 `content_factor`
- [ ] 支持记录来源方式 `manual / ai / history_reference`

验收标准：

- 清单项下可维护多条定额
- 锁定版本下定额页进入只读
- 每条定额都能追溯来源方式

## 3.4 定额选择器

### 3.4.1 查询能力

- [ ] 支持按 `standardSetCode` 查询定额
- [ ] 支持按 `disciplineCode` 查询定额
- [ ] 支持按关键字查询 `quotaCode` / `quotaName`
- [ ] 支持按章节号过滤

### 3.4.2 选择器逻辑

- [ ] 从项目默认专业定额集预填
- [ ] 支持切换定额集后重新拉取
- [ ] 支持单条选择
- [ ] 支持批量添加到清单项

验收标准：

- 选择器可按项目专业默认定额集工作
- 批量添加后能正确落库到 `quota_line`

## 3.5 价目版本模块

### 3.5.1 数据层

- [ ] 实现 `price_version` 仓储
- [ ] 实现 `price_item` 仓储

### 3.5.2 服务层

- [ ] 支持按地区和版本查询价目版本
- [ ] 支持按定额编号命中价目明细
- [ ] 支持项目绑定默认价目版本
- [ ] 支持清单项局部切换价目版本

### 3.5.3 接口建议

- [ ] 增加 `GET /api/v1/price-versions`
- [ ] 增加 `GET /api/v1/price-versions/{id}/items`
- [ ] 增加 `PUT /api/v1/projects/{id}/default-price-version`

验收标准：

- 可查询不同地区、不同版本的价目
- 切换价目版本后可触发后续重算

## 3.6 取费模板模块

### 3.6.1 数据层

- [ ] 实现 `fee_template` 仓储
- [ ] 实现 `fee_rule` 仓储

### 3.6.2 服务层

- [ ] 支持按地区查询模板
- [ ] 支持按项目类型查询模板
- [ ] 支持按阶段命中模板
- [ ] 支持按专业命中取费规则

### 3.6.3 接口建议

- [ ] 增加 `GET /api/v1/fee-templates`
- [ ] 增加 `GET /api/v1/fee-templates/{id}`
- [ ] 增加 `PUT /api/v1/projects/{id}/default-fee-template`

验收标准：

- 项目可绑定默认取费模板
- 不同专业可命中不同取费规则

## 3.7 计价引擎

### 3.7.1 单项计价

- [ ] 实现 `POST /api/v1/engine/calculate`
- [ ] 根据 `quota_line` 聚合基础费用
- [ ] 根据价目版本命中人工/材料/机械价格
- [ ] 根据取费模板计算费用分摊
- [ ] 计算 `system_unit_price`
- [ ] 计算 `system_amount`

### 3.7.2 人工调整

- [ ] 支持写入 `manual_unit_price`
- [ ] 支持保留系统值不被覆盖
- [ ] 支持计算 `final_unit_price`
- [ ] 支持计算 `final_amount`

### 3.7.3 批量重算

- [ ] 支持按清单项重算
- [ ] 支持按专业重算
- [ ] 支持按单体重算
- [ ] 支持按项目重算
- [ ] 记录重算触发原因

验收标准：

- 单个清单项可算出系统值和最终值
- 人工调价后仍可保留系统值
- 切换价目版本或取费模板后可触发重算

## 3.8 校验规则

- [ ] 缺少定额时返回可识别提示
- [ ] 缺少价目时返回 `warning`
- [ ] 缺少取费模板时返回 `warning`
- [ ] 定额单位与清单单位不一致时返回校验结果
- [ ] 同一清单项无定额时禁止进入“计价完成”态

验收标准：

- 校验结果可落到 `validation_status`
- 重大错误不会静默吞掉

## 3.9 权限与锁定

- [ ] 实现 `quota:view`
- [ ] 实现 `quota:edit`
- [ ] 实现 `quota:submit`
- [ ] 实现价目版本只读权限
- [ ] 实现取费模板只读权限
- [ ] 实现锁定版本下定额与调价写接口统一拦截

验收标准：

- `reviewer` 可查看定额结果但不能直接修改
- `cost_engineer` 可编辑定额和人工调价
- 锁定版本下调价接口返回 `423`

## 3.10 审计与追溯

- [ ] 定额新增/修改写审计日志
- [ ] 价目版本切换写审计日志
- [ ] 取费模板切换写审计日志
- [ ] 人工调价写审计日志
- [ ] 批量重算写审计日志

验收标准：

- 任意清单项价格变化都可追溯到原因和操作人

## 3.11 前端联动建议

- [ ] 定额区支持主表 + 右侧详情
- [ ] 支持批量添加定额
- [ ] 支持切换价目版本
- [ ] 支持切换取费模板
- [ ] 支持查看系统值、人工值、最终值
- [ ] 支持触发单项重算

前端最少展示字段：

- `quotaCode`
- `quotaName`
- `unit`
- `quantity`
- `unitPrice`
- `laborFee`
- `materialFee`
- `machineFee`
- `contentFactor`
- `sourceMode`
- `validationStatus`

## 4. 建议排期

### Day 1-2

- 建表迁移
- 定额接口
- 定额选择器查询

### Day 3-4

- 价目版本模块
- 取费模板模块

### Day 5-6

- 单项计价
- 批量重算
- 人工调价

### Day 7

- 权限与锁定联调
- 集成测试
- 文档回写

## 5. 联调顺序

建议按下面顺序联调：

1. 查询清单项下的定额
2. 新增和编辑定额
3. 查询价目版本
4. 查询取费模板
5. 绑定价目版本和取费模板
6. 触发单项计价
7. 触发批量重算

## 6. 风险点

- 如果 `price_item` 和 `quota_line` 的编号口径不统一，价目命中会大量失败
- 如果系统值和人工值没有从一开始就拆开，后面人工调价会覆盖历史依据
- 如果批量重算没有范围控制，项目大数据量时会拖垮接口
- 若取费模板命中规则不明确，不同专业和阶段会出现价格漂移

## 7. 完成标准

Iteration 3 完成时，至少满足以下结果：

- 清单项下可维护和查询定额明细
- 可查询和绑定价目版本
- 可查询和绑定取费模板
- 可完成单项计价和批量重算
- 可保留系统值、人工值、最终值三套口径
- 权限、锁定和审计规则全部生效
