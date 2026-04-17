# 新点源数据到 SaaS 字段映射

> 基于 [profession-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/profession-model.md)、[data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md) 与源目录 [/Users/huahaha/WorkSpace/something/新点清单造价江苏版](/Users/huahaha/WorkSpace/something/新点清单造价江苏版) 整理。

## 1. 文档目标

本文档用于明确“新点清单造价江苏版”中的源字段，如何映射到你当前 SaaS 造价系统的数据模型中。

主要服务于以下场景：

- 旧系统数据导入
- 数据库建模校验
- ETL/转换脚本开发
- 接口兼容层设计

## 2. 映射原则

1. 优先保留源系统主键、编码和版本字段，避免后续无法追溯。
2. 不把多个语义不同的源字段合并成一个 SaaS 字段，除非明确只是展示用途。
3. “专业”“定额集”“清单规范版本”分开建模。
4. 对无法完全落入当前 V1 模型的源字段，先进入 `source_payload` 或预留字段，不直接丢弃。

## 3. 专业字段映射

### 3.1 源字段来源

来源文件：

- [jiangsu.xml](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/bin/province/zhibiao/jiangsu.xml)
- [biaozhun.xml](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/bin/province/zhibiao/biaozhun.xml)

关键结构：

```xml
<Gcxxmx BZBm="Zy" Bm="ZY" Mc="专业"/>
<ZyItem Name="建筑工程" Markup="1" GB08="AB" GB13="01B" Zylb="建安"/>
```

### 3.2 映射表

| 源系统 | 源字段 | 含义 | SaaS 建议字段 | 备注 |
|-------|------|------|---------------|------|
| XML | `Bm=ZY` | 专业业务字段编码 | `project_discipline.source_field_code` | 建议保留为元数据 |
| XML | `ZyItem.Name` | 专业名称 | `discipline_type.discipline_name` | 如建筑工程、安装工程 |
| XML | `ZyItem.Markup` | 源系统专业编码 | `discipline_type.source_markup` | 不建议直接当 SaaS 主键 |
| XML | `ZyItem.GB08` | 08规范映射码 | `discipline_type.gb08_code` | 可为空 |
| XML | `ZyItem.GB13` | 13规范映射码 | `discipline_type.gb13_code` | 可为空 |
| XML | `ZyItem.Zylb` | 专业类别 | `discipline_type.discipline_group` | 建安、市政、园林等 |
| XML | `FileType.Name` | 业务视图名称 | `discipline_type.business_view_type` | 造价10、清标、南京 |
| 目录上下文 | `江苏` | 地区 | `discipline_type.region_code` | 建议统一 `jiangsu` |

### 3.3 额外建议字段

你当前模型里还没有单独的专业主表，建议新增：

```yaml
discipline_type:
  - id
  - discipline_code
  - discipline_name
  - source_markup
  - gb08_code
  - gb13_code
  - discipline_group
  - business_view_type
  - region_code
  - source_system
  - status
  - created_at
  - updated_at
```

## 4. 定额集字段映射

### 4.1 源字段来源

来源文件：

- [api_server.py](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/api_server.py)
- [dwgj.db](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/Data/江苏/Dek/dwgj.db)

关键结构：

```python
'012003tj': '2003土建工程'
'012013az': '2013安装工程'
```

数据库主表：

- `Dwgj`

### 4.2 映射表

| 源系统 | 源字段 | 含义 | SaaS 建议字段 | 备注 |
|-------|------|------|---------------|------|
| Python 映射 | `DEK_NAME.key` | 定额集编码 | `standard_set.standard_set_code` | 核心编码 |
| Python 映射 | `DEK_NAME.value` | 定额集名称 | `standard_set.standard_set_name` | 展示名 |
| SQLite | `Dwgj.DekID` | 定额集编码 | `standard_set.standard_set_code` | 与上面一致 |
| 编码规则 | `012013tj` | 年份+类型组合 | `standard_set.version_year` / `standard_set.standard_type` | 需要解析 |

### 4.3 建议解析规则

当前可先按经验解析：

| 编码后缀 | 建议标准类型 |
|---------|-------------|
| `tj` | 土建 |
| `az` | 安装 |
| `sz` | 市政 |
| `zs` | 装饰 |
| `yl` / `ylyh` / `yh` | 园林 |
| `gl` | 公路 |
| `dt` | 地铁/轨道 |

说明：

- 这部分建议先作为导入规则，不建议在 V1 数据模型里完全靠字符串推断。
- 更稳妥的方式是后续建立 `standard_set_type_mapping`。

## 5. 定额明细字段映射

### 5.1 源字段来源

来源库：

- [dwgj.db](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/Data/江苏/Dek/dwgj.db)

主表：

- `Dwgj`

### 5.2 映射表

| 源表 | 源字段 | 含义 | SaaS 字段 | 备注 |
|------|------|------|-----------|------|
| `Dwgj` | `DekID` | 定额集编码 | `quota_line.standard_set_code` 或关联 `standard_set` | 当前模型建议通过 `price_version/standard_set` 关联 |
| `Dwgj` | `DeID` | 源系统定额 ID | `quota_line.source_quota_id` | 建议新增保留字段 |
| `Dwgj` | `SJXH` | 数据序号 | `quota_line.source_sequence` | 可选保留 |
| `Dwgj` | `Debh` | 定额编号 | `quota_line.quota_code` | 核心字段 |
| `Dwgj` | `Demc` | 定额名称 | `quota_line.quota_name` | 核心字段 |
| `Dwgj` | `DeDj` | 定额单价 | `quota_line.unit_price` | 可作为默认单价来源 |
| `Dwgj` | `Dw` | 定额单位 | `quota_line.unit` | 核心字段 |
| `Dwgj` | `Zjh` | 章节号 | `quota_line.chapter_code` | 建议新增保留字段 |

### 5.3 对当前模型的补充建议

建议在 `quota_line` 上补几个源系统保留字段：

- `source_standard_set_code`
- `source_quota_id`
- `source_sequence`
- `chapter_code`

## 6. 清单集合字段映射

### 6.1 源字段来源

来源库：

- [Qdk_UpdateEPC.qa](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/Data/江苏/Dek/Qdk_UpdateEPC.qa)

主表：

- `ZaoJia_Qd_QdList`

### 6.2 映射表

| 源表 | 源字段 | 含义 | SaaS 建议字段 | 备注 |
|------|------|------|---------------|------|
| `ZaoJia_Qd_QdList` | `QdGf` | 清单规范/清单版本编码 | `bill_version.source_spec_code` | 建议新增保留字段 |
| `ZaoJia_Qd_QdList` | `Qdmc` | 清单集合名称 | `bill_version.source_spec_name` | 如 EPC项目 |
| `ZaoJia_Qd_QdList` | `IsVisible` | 是否显示 | `bill_version.source_visible_flag` | 可选保留 |
| `ZaoJia_Qd_QdList` | `IsDefault` | 是否默认 | `bill_version.source_default_flag` | 可选保留 |

## 7. 清单项目字段映射

### 7.1 源字段来源

来源库：

- `ZaoJia_Qd_Qdxm`

### 7.2 映射表

| 源表 | 源字段 | 含义 | SaaS 字段 | 备注 |
|------|------|------|-----------|------|
| `ZaoJia_Qd_Qdxm` | `QdGf` | 清单规范版本编码 | `bill_version.source_spec_code` | 版本级字段 |
| `ZaoJia_Qd_Qdxm` | `Sjxh` | 序号 | `bill_item.source_sequence` | 建议新增保留字段 |
| `ZaoJia_Qd_Qdxm` | `QdID` | 源系统清单 ID | `bill_item.source_bill_id` | 建议新增保留字段 |
| `ZaoJia_Qd_Qdxm` | `Qdbh` | 清单编号 | `bill_item.item_code` | 核心字段 |
| `ZaoJia_Qd_Qdxm` | `Xmmc` | 项目名称 | `bill_item.item_name` | 核心字段 |
| `ZaoJia_Qd_Qdxm` | `Dw` | 单位 | `bill_item.unit` | 核心字段 |
| `ZaoJia_Qd_Qdxm` | `Fbcch` | 分部层次号 | `bill_item.item_level` / `bill_item.source_level_code` | 不建议直接一刀切覆盖 |
| `ZaoJia_Qd_Qdxm` | `Iscs` | 是否措施项目 | `bill_item.is_measure_item` | 建议新增布尔字段 |
| `ZaoJia_Qd_Qdxm` | `Jsgz` | 计算规则 | `bill_item.feature_rule_text` | 可直接映射 |
| `ZaoJia_Qd_Qdxm` | `Dj` | 参考单价 | `bill_item.source_reference_price` | 不建议直接映射为正式价格 |
| `ZaoJia_Qd_Qdxm` | `QfID` | 取费ID | `bill_item.source_fee_id` | 建议保留 |
| `ZaoJia_Qd_Qdxm` | `Cslb` | 措施类别 | `bill_item.measure_category` | 建议新增 |
| `ZaoJia_Qd_Qdxm` | `CsfyBj` | 措施费用标记 | `bill_item.measure_fee_flag` | 建议新增 |
| `ZaoJia_Qd_Qdxm` | `CslbXf` | 措施类别细分 | `bill_item.measure_category_subtype` | 建议新增 |

### 7.3 层级字段说明

从样本看：

- `Qdbh=01` 对应“建筑工程”
- `Qdbh=0101` 对应“住宅 多层”
- `Qdbh=010101` 对应章节
- `Qdbh=010101001` 对应真正清单项

而 `Fbcch` 取值如 `1/2/3/5`

因此建议：

- `Qdbh` 继续作为主层级编码依据
- `Fbcch` 不直接等于你系统里的 `item_level`
- 你系统里保留：
  - `item_level`
  - `source_level_code`
  - `parent_id`

这样更安全。

## 8. 工作内容字段映射

### 8.1 源字段来源

来源表：

- `ZaoJia_Qd_Gznr`

### 8.2 映射表

| 源表 | 源字段 | 含义 | SaaS 字段 | 备注 |
|------|------|------|-----------|------|
| `ZaoJia_Qd_Gznr` | `QdGf` | 清单规范编码 | `bill_item_work_item.source_spec_code` | 建议新增子表 |
| `ZaoJia_Qd_Gznr` | `QdID` | 清单源 ID | `bill_item_work_item.source_bill_id` | 关联主清单 |
| `ZaoJia_Qd_Gznr` | `Sjxh` | 工作内容序号 | `bill_item_work_item.sort_order` | 可直接映射 |
| `ZaoJia_Qd_Gznr` | `Gznr` | 工作内容 | `bill_item_work_item.work_content` | 核心字段 |

### 8.3 对当前模型的建议

你现在的 `bill_item.feature_rule_text` 只能容纳“项目特征/计算规则”。

但源软件里“工作内容”是独立子表，所以如果你后面想做高保真导入，建议新增：

```yaml
bill_item_work_item:
  - id
  - bill_item_id
  - source_spec_code
  - source_bill_id
  - sort_order
  - work_content
  - created_at
```

## 9. 当前 SaaS 模型需要补的字段

为了兼容源系统导入，建议在现有模型上补以下字段：

### 9.1 `bill_version`

- `source_spec_code`
- `source_spec_name`

### 9.2 `bill_item`

- `source_bill_id`
- `source_sequence`
- `source_level_code`
- `is_measure_item`
- `source_reference_price`
- `source_fee_id`
- `measure_category`
- `measure_fee_flag`
- `measure_category_subtype`

### 9.3 `quota_line`

- `source_standard_set_code`
- `source_quota_id`
- `source_sequence`
- `chapter_code`

## 10. 映射优先级建议

导入或兼容时，建议按以下优先级处理：

1. 先映射源系统标识字段
   - `QdGf`
   - `QdID`
   - `DekID`
   - `DeID`
2. 再映射业务主字段
   - `Qdbh`
   - `Xmmc`
   - `Dw`
   - `Debh`
   - `Demc`
3. 最后映射辅助字段
   - `Fbcch`
   - `QfID`
   - `Cslb`
   - `CsfyBj`
   - `Gznr`

## 11. 当前能稳定落地的结论

到目前为止，已经可以稳定落地以下事实：

- 源系统“专业”字段编码是 `ZY`
- 源系统“专业”和“定额集”是两套模型
- 定额明细真实存储核心表是 `Dwgj`
- 清单项目真实存储核心表是 `ZaoJia_Qd_Qdxm`
- 工作内容真实存储在独立子表 `ZaoJia_Qd_Gznr`
- `QdGf / QdID / DekID` 都应该在你的系统里以源字段方式保留

## 12. 下一步建议

如果继续往下做，最值得的两个方向是：

1. 把这些新增字段正式回写进 [data-model.md](/Users/huahaha/Documents/New%20project/docs/architecture/data-model.md)
2. 继续分析“安装工程”是否存在更细的二级专业或分系统结构

我建议先做 `1`，把当前已经验证过的映射结果正式吸收进你的目标数据模型。 
