# 新点 SaaS 造价系统 V1 后端实施检查清单

> 基于 [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)、[state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md)、[permission-matrix.md](/Users/huahaha/Documents/New%20project/docs/architecture/permission-matrix.md) 与 [openapi-v1.yaml](/Users/huahaha/Documents/New%20project/docs/api/openapi-v1.yaml) 整理。

## 1. 使用方式

这份清单不是产品文档，而是后端落地顺序清单。建议按章节顺序推进，每完成一块就打勾，并在代码库里同步提交对应产物。

## 2. 基础准备

- [ ] 确认后端技术栈、ORM、迁移工具、鉴权方案
- [ ] 确认环境划分：`local / test / prod`
- [ ] 建立统一配置项：数据库、Redis、对象存储、JWT、异步任务队列
- [ ] 建立基础目录结构：`modules`, `schemas`, `services`, `repositories`, `policies`, `jobs`
- [ ] 建立统一错误码和响应包装

## 3. 数据库与迁移

### 3.1 第一批核心表

- [ ] 创建 `project`
- [ ] 创建 `project_stage`
- [ ] 创建 `project_member`
- [ ] 创建 `project_role_scope`
- [ ] 建立主外键和唯一索引
- [ ] 建立基础枚举或约束表

### 3.2 第二批业务主表

- [ ] 创建 `bill_version`
- [ ] 创建 `bill_item`
- [ ] 创建 `quota_line`
- [ ] 创建 `price_version`
- [ ] 创建 `price_item`
- [ ] 创建 `fee_template`
- [ ] 创建 `fee_rule`

### 3.3 第三批流程与审计表

- [ ] 创建 `review_submission`
- [ ] 创建 `change_order`
- [ ] 创建 `site_visa`
- [ ] 创建 `progress_payment`
- [ ] 创建 `settlement_record`
- [ ] 创建 `audit_log`
- [ ] 创建 `ai_recommendation`

### 3.4 第四批 AI 原生扩展表

- [ ] 创建 `knowledge_entry`
- [ ] 创建 `memory_entry`
- [ ] 创建 `skill_definition`
- [ ] 创建 `knowledge_relation`

### 3.5 数据库检查项

- [ ] 所有主键统一为 `uuid`
- [ ] 所有业务表具备 `created_at / updated_at`
- [ ] 关键表具备必要唯一约束
- [ ] 禁止对核心业务表启用危险级联删除
- [ ] 为高频查询字段建立索引
- [ ] 为 `knowledge_entry / memory_entry / knowledge_relation` 建立基础检索索引

## 4. 枚举与状态常量

- [ ] 固化项目状态枚举
- [ ] 固化阶段状态枚举
- [ ] 固化清单版本状态枚举
- [ ] 固化锁定状态枚举
- [ ] 固化审核状态枚举
- [ ] 固化过程单据状态枚举
- [ ] 固化报表任务状态枚举
- [ ] 固化 AI 推荐状态枚举
- [ ] 固化阶段编码、角色编码、业务身份编码

检查项：

- [ ] 所有状态机枚举值与 [state-machines.md](/Users/huahaha/Documents/New%20project/docs/architecture/state-machines.md) 一致
- [ ] 所有接口返回值与 `openapi-v1.yaml` 一致

## 5. 鉴权与权限中间件

- [ ] 实现 JWT 鉴权中间件
- [ ] 实现当前用户上下文注入
- [ ] 实现平台角色校验中间件
- [ ] 实现项目成员访问校验
- [ ] 实现阶段权限校验
- [ ] 实现专业/单体范围校验
- [ ] 实现锁定态拦截
- [ ] 实现审编分离校验

检查项：

- [ ] `project_owner` 不自动拥有全部项目权限，必须是项目成员
- [ ] `reviewer` 不能审核自己提交的资源
- [ ] 已锁定资源写接口返回 `423`

## 6. 项目与阶段模块

- [ ] 实现 `POST /api/v1/projects`
- [ ] 实现 `GET /api/v1/projects/{id}`
- [ ] 实现 `GET /api/v1/projects/{id}/stages`
- [ ] 实现 `PUT /api/v1/projects/{id}/stages`
- [ ] 实现项目创建时的默认阶段模板展开
- [ ] 实现阶段顺序合法性校验
- [ ] 实现阶段负责人、审核人配置落库

检查项：

- [ ] 禁止阶段顺序形成环
- [ ] 禁止启用阶段缺少负责人时直接进入执行
- [ ] 禁止同一项目出现重复阶段编码

## 7. 清单与版本链模块

- [ ] 实现 `bill_version` 创建逻辑
- [ ] 实现导入生成初始版本逻辑
- [ ] 实现上游版本引用生成新版本逻辑
- [ ] 实现合同基线锁定逻辑
- [ ] 实现 `GET /api/v1/projects/{id}/bill-items`
- [ ] 实现 `POST /api/v1/projects/{id}/bill-items`
- [ ] 实现 `PUT /api/v1/projects/{id}/bill-items/{itemId}`
- [ ] 实现清单树结构存储与排序
- [ ] 实现来源版本追溯字段

检查项：

- [ ] 锁定版本不可直接修改
- [ ] 驳回后可重新回到 `editable`
- [ ] 任意清单项可查到来源版本标签

## 8. 定额、价目与取费模块

- [ ] 实现 `GET /api/v1/projects/{id}/quota-lines`
- [ ] 实现 `POST /api/v1/projects/{id}/quota-lines`
- [ ] 实现 `PUT /api/v1/projects/{id}/quota-lines/{lineId}`
- [ ] 实现价目版本绑定与切换
- [ ] 实现取费模板绑定与优先级命中
- [ ] 实现含量系数调整
- [ ] 实现定额套用校验

检查项：

- [ ] 价目切换后能够触发重算
- [ ] 人工改价保留系统值
- [ ] 定额来源方式正确记录为 `manual / ai / history_reference`

## 9. 计价引擎

- [ ] 实现单项计价服务
- [ ] 实现批量重算服务
- [ ] 实现费用分摊策略
- [ ] 实现系统值、人工值、最终值并存
- [ ] 实现 `POST /api/v1/engine/calculate`
- [ ] 实现重算任务日志

检查项：

- [ ] 输入不完整时返回 `422`
- [ ] 重算范围支持单行、单专业、单体、全项目
- [ ] 审核驳回后重新编辑能正确触发重算

## 10. 审核流与锁定流

- [ ] 实现 `POST /api/v1/projects/{id}/review-submissions`
- [ ] 实现审核通过逻辑
- [ ] 实现审核驳回逻辑
- [ ] 实现撤销提交逻辑
- [ ] 实现锁定申请与解锁申请逻辑
- [ ] 实现清单版本状态与阶段状态联动

检查项：

- [ ] 同一资源不能并存多个 `pending` 审核记录
- [ ] 审核通过后状态进入正确下游状态
- [ ] 解锁必须保留申请原因

## 11. 过程单据模块

- [ ] 实现 `POST /api/v1/projects/{id}/change-orders`
- [ ] 实现 `POST /api/v1/projects/{id}/site-visas`
- [ ] 实现 `POST /api/v1/projects/{id}/progress-payments`
- [ ] 实现过程单据状态流转
- [ ] 实现过程单据与清单版本、汇总结果联动

检查项：

- [ ] 只有 `approved` 的过程单据能影响结算
- [ ] `rejected` 可回退到 `draft`
- [ ] `settled` 后金额类字段不可编辑

## 12. 汇总与报表模块

- [ ] 实现 `GET /api/v1/reports/summary`
- [ ] 实现按项目/阶段/专业/单体汇总
- [ ] 实现偏差分析查询
- [ ] 实现 `POST /api/v1/reports/export`
- [ ] 实现异步导出任务状态记录

检查项：

- [ ] 导出接口返回 `202`
- [ ] 报表任务支持 `queued / processing / completed / failed`
- [ ] 汇总结果支持查看系统值与最终值

## 13. 审计日志

- [ ] 为项目、阶段、清单、定额、审核、锁定、过程单据接入审计日志
- [ ] 写入 `before_payload / after_payload`
- [ ] 记录操作人、项目、阶段、动作
- [ ] 提供内部查询能力
- [ ] 为 AI 推荐接受/忽略/失效写审计日志
- [ ] 为知识条目生成与记忆更新预留审计动作

检查项：

- [ ] 所有状态切换都有审计记录
- [ ] 所有关键写接口都有审计记录

## 14. AI 辅助模块

- [ ] 预留 AI 推荐服务调用接口
- [ ] 实现推荐结果缓存表写入
- [ ] 实现推荐结果接受/忽略/失效流转
- [ ] AI 结果不得直接覆盖正式业务数据
- [ ] 为后续知识抽取保留推荐结果、接受结果和失效原因
- [ ] 为后续系统记忆更新保留推荐反馈信号

检查项：

- [ ] 版本变化时旧推荐进入 `expired`
- [ ] AI 失败不阻断主业务流程

## 15. MCP 与知识/记忆预留

- [ ] 预留 MCP 能力模块目录：`mcp-capability`, `mcp-context-builder`, `mcp-permission-guard`
- [ ] 实现项目级上下文聚合服务
- [ ] 实现阶段级上下文聚合服务
- [ ] 实现知识条目搜索服务
- [ ] 实现项目记忆和组织记忆读取服务
- [ ] 预留 skills 定义读取接口

检查项：

- [ ] MCP 上下文服务不直接绕过应用服务查库
- [ ] MCP 返回结果继续受项目权限、阶段权限和资源权限裁剪
- [ ] 项目级上下文至少能聚合项目、阶段、专业、风险摘要

## 16. 知识与记忆抽取预留

- [ ] 为项目复盘结构化结论预留写入 `knowledge_entry` 的服务
- [ ] 为审核驳回原因标签化预留存储结构
- [ ] 为 AI 推荐反馈写入 `memory_entry` 的服务
- [ ] 为知识关系 `knowledge_relation` 预留基础写入能力

检查项：

- [ ] 至少一类复盘结论可落知识条目
- [ ] 至少一类项目偏好或组织偏好可落记忆条目
- [ ] 知识与记忆对象不直接干扰主业务事务链

## 17. 测试清单

### 15.1 单元测试

- [ ] 项目创建与阶段模板展开
- [ ] 阶段状态迁移
- [ ] 清单版本创建与引用
- [ ] 锁定规则
- [ ] 计价计算
- [ ] 权限中间件

### 15.2 集成测试

- [ ] 创建项目 -> 配置阶段 -> 新增清单 -> 提交审核
- [ ] 投标报价引用招标清单生成新版本
- [ ] 合同清单锁定后无法直接修改
- [ ] 施工过程创建变更并触发重算
- [ ] 审核驳回后恢复可编辑

### 15.3 接口契约测试

- [ ] OpenAPI 与实际响应字段一致
- [ ] 错误码与文档一致
- [ ] `423` 锁定态返回正确
- [ ] `202` 异步任务返回正确

## 18. 上线前检查

- [ ] 完成数据库迁移脚本审查
- [ ] 完成权限回归测试
- [ ] 完成状态机回归测试
- [ ] 完成关键接口联调
- [ ] 完成导出任务压测
- [ ] 完成审计日志抽样检查
- [ ] 完成知识条目与记忆条目基础写入验证
- [ ] 完成 MCP 上下文结果抽样验证

## 19. 建议的实际推进顺序

1. 数据库与迁移
2. 枚举与状态常量
3. 鉴权与权限中间件
4. 项目与阶段模块
5. 清单与版本链模块
6. 定额、价目与取费模块
7. 计价引擎
8. 审核流与锁定流
9. 过程单据模块
10. 汇总与报表模块
11. 审计日志
12. AI 辅助模块
13. MCP 与知识/记忆预留
14. 测试与回归

## 20. 下一步建议

如果你准备正式进入开发，接下来最顺的是：

1. 我继续帮你拆 `Iteration 1` 的具体开发任务
2. 或者我直接帮你生成第一批数据库表的 SQL 草案 / Prisma schema / TypeORM entity

建议优先做 `Iteration 1 开发任务拆分`。 
