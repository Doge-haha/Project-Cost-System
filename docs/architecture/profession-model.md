# 新点清单造价江苏版专业模型提取说明

> 来源目录：[/Users/huahaha/WorkSpace/something/新点清单造价江苏版](/Users/huahaha/WorkSpace/something/新点清单造价江苏版)

## 1. 文档目标

本文档用于把从“新点清单造价江苏版”根目录中提取到的“专业字段、专业分类、定额集映射、清单字段格式”固化下来，作为你当前 SaaS 造价系统设计中的专业模型参考来源。

本文档当前只固化已经确认的信息，不对尚未完全验证的字段做过度推断。

## 2. 已确认的数据来源

### 2.1 专业定义主配置

- [jiangsu.xml](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/bin/province/zhibiao/jiangsu.xml)
- [biaozhun.xml](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/bin/province/zhibiao/biaozhun.xml)

这两份 XML 中都存在：

```xml
<Gcxxmx BZBm="Zy" Bm="ZY" Mc="专业"/>
```

可确认结论：

- 软件中的“专业”在工程信息字段中的业务编码是 `ZY`
- “专业”属于工程信息主字段之一

### 2.2 定额集映射脚本

- [api_server.py](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/api_server.py)

该文件中存在 `DEK_NAME` 映射，说明软件内部把“专业”与“定额集”分开维护。

### 2.3 清单字段导出样本

- [清单库_清单项目.csv](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/导出/清单库_清单项目.csv)

这份导出说明软件内部清单模型至少包含清单编号、名称、单位、计算规则、层级等字段。

## 3. 专业字段结构

### 3.1 XML 中的专业结构

在 `jiangsu.xml` 与 `biaozhun.xml` 中，专业定义结构如下：

```xml
<ZyItem Name="建筑工程" Markup="1" GB08="AB" GB13="01B" Zylb="建安"/>
```

由此可确认，一个专业定义至少包含以下字段：

| 字段 | 来源属性 | 含义 |
|------|---------|------|
| 专业名称 | `Name` | 专业显示名称 |
| 专业内部编码 | `Markup` | 软件内部专业编码 |
| 08规范编码 | `GB08` | 对应 2008 规范映射码 |
| 13规范编码 | `GB13` | 对应 2013 规范映射码 |
| 专业类别 | `Zylb` | 业务分类，如建安、市政、园林、轨道 |

### 3.2 推荐抽象字段

结合你当前系统设计，建议把“专业”抽象为以下字段：

| 推荐字段 | 说明 |
|---------|------|
| `discipline_code` | 你系统内部专业编码 |
| `discipline_name` | 专业名称 |
| `source_markup` | 源软件中的 `Markup` |
| `gb08_code` | 源软件中的 `GB08` |
| `gb13_code` | 源软件中的 `GB13` |
| `discipline_group` | 源软件中的 `Zylb` |
| `business_view_type` | 对应哪类业务视图，如造价、清标、地区版 |
| `region_code` | 地区编码，如 `jiangsu` |
| `status` | 是否启用 |

## 4. 江苏版已识别专业

### 4.1 造价10视图

来源：[jiangsu.xml](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/bin/province/zhibiao/jiangsu.xml)

| Name | Markup | GB08 | GB13 | Zylb |
|------|--------|------|------|------|
| 建筑工程 | 1 | AB | 01B | 建安 |
| 装饰工程 | 2 | BB | 01B | 建安 |
| 安装工程 | 3 | CB | 03B | 建安 |
| 市政工程 | 4 | DB | 04B | 市政 |
| 园林绿化工程 | 5 | EB | 05B | 园林 |
| 城市轨道工程 | 7 | AB | 08B | 轨道 |
| 矿山工程 | 8 | FB | 06B | 矿山 |
| 修缮工程 | 9 | AB | 01B | 园林 |
| 修缮工程 | 10 | AB | 01B | 园林 |
| 修缮工程 | 11 | AB | 01B | 园林 |
| 市政工程 | 12 | EB | 05B | 市政 |
| 管廊工程 | 26 | AB | 10B | 管廊 |
| 管廊工程 | 27 | AB | 10B | 管廊 |
| 人防工程 | 29 | 空 | 空 | 空 |

说明：

- 同名专业可能对应多个 `Markup`
- 同一个名称不一定只映射一个规范编码
- `Markup` 在源软件中更接近“具体专业视图编码”，而不是稳定的跨版本主键

### 4.2 清标视图

来源同上，`FileType Markup="1" Name="清标"`

| Name | Markup |
|------|--------|
| 建筑工程 | 1 |
| 装饰工程 | 2 |
| 安装工程 | 3 |
| 市政工程 | 4 |
| 园林绿化工程 | 5 |
| 轨道工程 | 6 |
| 修缮土建工程 | 7 |
| 修缮安装工程 | 8 |
| 修缮加固工程 | 9 |
| 掘开式工程 | 10 |
| 坑地道工程 | 11 |
| 管廊土建 | 12 |
| 管廊安装 | 13 |

说明：

- 这套“专业”更接近业务视图或业务分组
- 它和“造价10”中的专业集合不是完全一一对应关系

### 4.3 南京视图

来源同上，`FileType Markup="11" Name="南京"`

| Name | Markup |
|------|--------|
| 建筑工程 | 1 |
| 装饰工程 | 2 |
| 安装工程 | 3 |
| 市政工程 | 4 |
| 园林绿化工程 | 5 |
| 轨道工程 | 6 |
| 修缮土建工程 | 7 |
| 修缮安装工程 | 8 |
| 修缮加固工程 | 9 |
| 管廊土建 | 10 |
| 管廊安装 | 11 |

说明：

- 说明“专业集合”还可能随地区或业务版本变化

## 5. 关键结论

### 5.1 专业不是单一枚举

从源软件结构看，“专业”至少有两层：

1. 标准专业主数据
   例如建筑工程、安装工程、市政工程
2. 业务视图专业
   例如清标视图、地区版视图、修缮土建、管廊安装

因此你当前系统里不建议只用一个 `discipline_name` 字段糊过去。

### 5.2 专业与定额集必须分开建模

从 [api_server.py](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/api_server.py:17) 可见，软件内部单独维护定额集映射：

```python
'012003tj': '2003土建工程'
'012013tj': '2013土建工程'
'012013az': '2013安装工程'
'012021sz': '2021市政工程'
'012002zs': '2002装饰工程'
```

这说明：

- `专业` 负责业务分类
- `定额集` 负责计价依据和版本
- 一个专业下会对应多个定额集

所以你系统里应至少拆成：

1. `discipline_type`
2. `standard_set`

而不是把两者揉进一个字段。

## 6. 定额集维度建议

从 `api_server.py` 可提取出的典型定额集包括：

| 定额集编码 | 名称 |
|-----------|------|
| `012003tj` | 2003土建工程 |
| `012013tj` | 2013土建工程 |
| `012000tj` | 2000土建工程 |
| `012003az` | 2003安装工程 |
| `012013az` | 2013安装工程 |
| `012000az` | 2000安装工程 |
| `012003sz` | 2003市政工程 |
| `012013sz` | 2013市政工程 |
| `012021sz` | 2021市政工程 |
| `012002zs` | 2002装饰工程 |
| `012017ylyh` | 2017园林绿化 |
| `012024xsgjz` | 2024现行建筑定额 |

建议你系统里使用如下结构：

| 字段 | 说明 |
|------|------|
| `standard_set_code` | 源软件定额集编码 |
| `standard_set_name` | 定额集名称 |
| `discipline_code` | 所属专业 |
| `version_year` | 年份或版本 |
| `region_code` | 地区 |
| `standard_type` | 土建/安装/市政/装饰等 |

## 7. 清单字段格式样本

从 [清单库_清单项目.csv](/Users/huahaha/WorkSpace/something/新点清单造价江苏版/导出/清单库_清单项目.csv) 读取到的表头为：

| 字段 | 说明 |
|------|------|
| `QdGf` | 清单库版本或规范版本字段 |
| `Sjxh` | 数据序号 |
| `QdID` | 清单内部 ID |
| `Qdbh` | 清单编号 |
| `Xmmc` | 项目名称 |
| `Dw` | 单位 |
| `Fbcch` | 分部层次号 |
| `Iscs` | 是否措施类标记 |
| `Jsgz` | 计算规则 |
| `Dj` | 单价或参考价 |
| `QfID` | 取费相关 ID |
| `Cslb` | 措施类别 |
| `CsfyBj` | 措施费用标记 |
| `CslbXf` | 措施类别细分 |

样本记录显示：

- `Qdbh` 可以是 `01`、`0101`、`010101`、`010101001`
- 说明清单本身有天然层级
- `Fbcch` 也体现层级深度，如 `1/2/3/5`

因此你当前系统里的清单模型保留：

- `item_code`
- `item_level`
- `parent_id`
- `sort_order`
- `feature_rule_text`

是合理的。

## 8. 建议落库模型

### 8.1 专业主表建议

```yaml
discipline_type:
  - discipline_code
  - discipline_name
  - source_markup
  - gb08_code
  - gb13_code
  - discipline_group
  - business_view_type
  - region_code
  - status
  - source_system
```

### 8.2 定额集主表建议

```yaml
standard_set:
  - standard_set_code
  - standard_set_name
  - discipline_code
  - version_year
  - region_code
  - standard_type
  - source_system
  - status
```

### 8.3 映射关系建议

- 一个 `discipline_type` 可以对应多个 `standard_set`
- 一个 `discipline_type` 可以在不同 `business_view_type` 下呈现不同名称或编码
- 不同地区的专业集合应保留 `region_code`

## 9. 对你当前系统的直接建议

如果要把这套模型接到你现在的 SaaS 设计里，我建议你：

1. 在 `data-model.md` 里新增 `discipline_type` 表
2. 在 `data-model.md` 里新增 `standard_set` 表
3. 在项目表或阶段表上增加默认专业视图配置
4. 在清单与定额页面都增加：
   - 当前专业
   - 当前定额集
   - 当前地区

## 10. 下一步建议

这份文档现在固化的是“已确认部分”。如果继续深挖，下一步最值得做的是：

1. 分析 SQLite 数据库里的专业、定额集、清单表结构
2. 抽取 XML 与 SQLite 之间的字段映射
3. 继续下钻“安装工程”内部是否还有更细的二级专业分类

如果你要，我下一步可以继续直接做第 `2` 步，也就是把 XML 与 SQLite 的字段映射关系再整理成一份正式文档。

## 11. SQLite 存储层分析

我已经确认该软件根目录下的两个核心数据文件均为 SQLite：

- `/Users/huahaha/WorkSpace/something/新点清单造价江苏版/Data/江苏/Dek/dwgj.db`
- `/Users/huahaha/WorkSpace/something/新点清单造价江苏版/Data/江苏/Dek/Qdk_UpdateEPC.qa`

### 11.1 定额库主表

来源：`dwgj.db`

表名：

- `Dwgj`

表结构：

```sql
CREATE TABLE IF NOT EXISTS "Dwgj" (
  [DekID] NVARCHAR(10) NOT NULL,
  [DeID] INT NOT NULL,
  [SJXH] DOUBLE NOT NULL,
  [Debh] NVARCHAR(50) NOT NULL,
  [Demc] NVARCHAR(255) NOT NULL,
  [DeDj] DECIMAL(18, 2) NOT NULL DEFAULT 0,
  [Dw] NVARCHAR(20) NOT NULL,
  [Zjh] NVARCHAR(50) NOT NULL
);
```

字段含义建议：

| 字段 | 含义 |
|------|------|
| `DekID` | 定额集编码 |
| `DeID` | 定额内部 ID |
| `SJXH` | 数据序号 |
| `Debh` | 定额编号 |
| `Demc` | 定额名称 |
| `DeDj` | 定额单价 |
| `Dw` | 单位 |
| `Zjh` | 章节号 |

可确认结论：

- 真实定额数据并不直接按“专业”存，而是按 `DekID` 这个定额集编码存
- 这进一步证明“专业”和“定额集”必须分开建模

### 11.2 清单库表

来源：`Qdk_UpdateEPC.qa`

已识别表：

- `ZaoJia_Qd_QdList`
- `ZaoJia_Qd_Qdxm`
- `ZaoJia_Qd_Gznr`

#### 11.2.1 清单集合表 `ZaoJia_Qd_QdList`

```sql
CREATE TABLE [ZaoJia_Qd_QdList] (
  [QdGf] NVARCHAR(10) NOT NULL,
  [Qdmc] NVARCHAR(50) NOT NULL,
  [IsVisible] BOOLEAN NOT NULL,
  [IsDefault] BOOLEAN,
  PRIMARY KEY ([QdGf])
);
```

样本数据：

| QdGf | Qdmc | IsVisible | IsDefault |
|------|------|-----------|-----------|
| `012019` | `EPC项目` | `1` | `0` |

字段含义建议：

| 字段 | 含义 |
|------|------|
| `QdGf` | 清单规范/清单版本编码 |
| `Qdmc` | 清单集合名称 |
| `IsVisible` | 是否可见 |
| `IsDefault` | 是否默认 |

#### 11.2.2 清单项目表 `ZaoJia_Qd_Qdxm`

```sql
CREATE TABLE [ZaoJia_Qd_Qdxm] (
  [QdGf] NVARCHAR(10) NOT NULL,
  [Sjxh] DOUBLE NOT NULL,
  [QdID] INT NOT NULL,
  [Qdbh] NVARCHAR(20) NOT NULL,
  [Xmmc] NVARCHAR(255) NOT NULL,
  [Dw] NVARCHAR(20) NOT NULL,
  [Fbcch] INT NOT NULL,
  [Iscs] BOOLEAN NOT NULL,
  [Jsgz] NVARCHAR(500) NOT NULL,
  [Dj] DECIMAL(18, 3) NOT NULL DEFAULT 0,
  [QfID] INT DEFAULT 0,
  [Cslb] NVARCHAR(255),
  [CsfyBj] NVARCHAR(10),
  [CslbXf] INT NOT NULL DEFAULT 0
);
CREATE INDEX [qdxmindex] ON [ZaoJia_Qd_Qdxm] ([QdGf], [QdID], [Qdbh]);
```

样本数据已确认：

| QdGf | QdID | Qdbh | Xmmc | Dw | Fbcch | Iscs | Jsgz |
|------|------|------|------|----|------|------|------|
| `012019` | `1` | `01` | `建筑工程` | 空 | `1` | `0` | 空 |
| `012019` | `2` | `0101` | `住宅 多层` | `m2` | `2` | `0` | `按建筑面积计算` |
| `012019` | `3` | `010101` | `A.2.1 土石方工程` | 空 | `3` | `0` | 空 |
| `012019` | `4` | `010101001` | `平整场地` | `m2` | `5` | `0` | `按设计图示尺寸以建筑物首层建筑面积计算` |

字段含义建议：

| 字段 | 含义 |
|------|------|
| `QdGf` | 所属清单规范版本 |
| `Sjxh` | 数据序号 |
| `QdID` | 清单内部 ID |
| `Qdbh` | 清单编号 |
| `Xmmc` | 项目名称 |
| `Dw` | 单位 |
| `Fbcch` | 分部层次号 |
| `Iscs` | 是否措施项目 |
| `Jsgz` | 计算规则 |
| `Dj` | 参考单价 |
| `QfID` | 取费 ID |
| `Cslb` | 措施类别 |
| `CsfyBj` | 措施费用标记 |
| `CslbXf` | 措施类别细分 |

#### 11.2.3 工作内容表 `ZaoJia_Qd_Gznr`

```sql
CREATE TABLE [ZaoJia_Qd_Gznr] (
  [QdGf] NVARCHAR(10) NOT NULL,
  [QdID] INT NOT NULL,
  [Sjxh] DOUBLE NOT NULL,
  [Gznr] NVARCHAR(255) NOT NULL
);
CREATE INDEX [Qd_Gznrindex] ON [ZaoJia_Qd_Gznr] ([QdGf], [QdID]);
```

样本数据：

| QdGf | QdID | Gznr |
|------|------|------|
| `012019` | `4` | `包括厚度≤±300mm 的开挖、回填、运输找平` |
| `012019` | `5` | `包括竖向土石方开挖、运输、弃土` |
| `012019` | `7` | `包括地下室大开挖、基坑、沟槽土石方开挖运输、弃土、基底钎探` |

可确认结论：

- “工作内容”在源软件里不是直接存在清单主表，而是独立子表
- 你当前系统如果要做高保真迁移，`bill_item` 未来最好支持关联一对多工作内容子项，而不是只靠一个文本字段

## 12. 对你当前 SaaS 系统的直接影响

结合 XML 与 SQLite，可得到以下更可靠的落地建议：

### 12.1 专业模型

- `ZY` 应作为源系统专业字段映射来源
- 专业主表不能只存名称，至少要存源编码和规范映射

### 12.2 定额模型

- `Dwgj.DekID` 应映射到你系统的 `standard_set_code`
- `Dwgj.Debh` 应映射到定额编号
- `Dwgj.Demc` 应映射到定额名称
- `Dwgj.Zjh` 可映射为定额章节号

### 12.3 清单模型

- `QdGf` 应视为清单规范版本/清单集合编码
- `QdID` 是清单内部主键，可作为源系统映射键保存
- `Qdbh` 是清单编号
- `Fbcch` 明显是层级字段，适合映射到你系统的 `item_level` 或层级辅助字段
- `Gznr` 最好从单独子表映射，不建议并入单条 `feature_rule_text`

## 13. 下一步建议

现在已经确认了三层信息：

1. XML 配置层：专业定义、专业视图
2. SQLite 存储层：定额表、清单表、工作内容表
3. 导出样本层：CSV 字段格式

如果继续往下做，最值得的下一步是：

1. 生成一份 `source-field-mapping.md`
   把源软件字段映射到你当前 SaaS 的字段
2. 分析“安装工程”是否还存在更细的二级专业或分系统分类
3. 抽取 `QdGf / DekID / ZY` 三者之间的关联规则
