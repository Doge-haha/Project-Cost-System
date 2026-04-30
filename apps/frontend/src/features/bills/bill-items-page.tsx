import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type {
  BillItem,
  BillVersion,
  FeeTemplate,
  PriceVersion,
  ProjectListItem,
  ProjectQuotaLine,
  QuotaSourceCandidate,
  QuotaLineValidationResult,
} from "../../lib/types";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import { BillVersionSelector } from "../shared/bill-version-selector";
import { AppBreadcrumbs, buildProjectVersionBreadcrumbs } from "../shared/breadcrumbs";
import { BillItemsTable, countLeafBillItems } from "./bill-items-table";

function flattenBillItems(items: BillItem[]): BillItem[] {
  return items.flatMap((item) => [
    item,
    ...flattenBillItems(item.children ?? []),
  ]);
}

function filterQuotaCandidates(
  candidates: QuotaSourceCandidate[],
  filter: string,
) {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) {
    return candidates;
  }

  return candidates.filter((candidate) =>
    [
      candidate.quotaCode,
      candidate.quotaName,
      candidate.chapterCode,
      candidate.unit,
      candidate.sourceMode,
      candidate.sourceDataset,
      candidate.sourceRegion,
      candidate.matchReason,
      candidate.workContentSummary,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedFilter)),
  );
}

function filterPriceVersions(priceVersions: PriceVersion[], filter: string) {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) {
    return priceVersions;
  }

  return priceVersions.filter((priceVersion) =>
    [
      priceVersion.versionCode,
      priceVersion.versionName,
      priceVersion.regionCode,
      priceVersion.disciplineCode,
      priceVersion.status,
    ].some((value) => String(value).toLowerCase().includes(normalizedFilter)),
  );
}

function filterFeeTemplates(feeTemplates: FeeTemplate[], filter: string) {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) {
    return feeTemplates;
  }

  return feeTemplates.filter((template) =>
    [
      template.templateName,
      template.projectType,
      template.regionCode,
      template.stageScope.join(" "),
      template.taxMode,
      template.allocationMode,
      template.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedFilter)),
  );
}

export function BillItemsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = params.projectId;
  const versionId = params.versionId;
  const [project, setProject] = useState<ProjectListItem | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [versions, setVersions] = useState<BillVersion[]>([]);
  const [quotaLines, setQuotaLines] = useState<ProjectQuotaLine[]>([]);
  const [quotaCandidates, setQuotaCandidates] = useState<QuotaSourceCandidate[]>([]);
  const [priceVersions, setPriceVersions] = useState<PriceVersion[]>([]);
  const [feeTemplates, setFeeTemplates] = useState<FeeTemplate[]>([]);
  const [selectedPriceVersionId, setSelectedPriceVersionId] = useState("");
  const [selectedFeeTemplateId, setSelectedFeeTemplateId] = useState("");
  const [selectedBillItemId, setSelectedBillItemId] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [quotaActionMessage, setQuotaActionMessage] = useState<string | null>(null);
  const [quotaValidation, setQuotaValidation] = useState<QuotaLineValidationResult | null>(null);
  const [pricingActionMessage, setPricingActionMessage] = useState<string | null>(null);
  const [manualUnitPrice, setManualUnitPrice] = useState("");
  const [manualPricingReason, setManualPricingReason] = useState("市场询价调整");
  const [billItemFilter, setBillItemFilter] = useState("");
  const [quotaCandidateFilter, setQuotaCandidateFilter] = useState("");
  const [priceVersionFilter, setPriceVersionFilter] = useState("");
  const [feeTemplateFilter, setFeeTemplateFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadBillItems() {
    if (!projectId || !versionId) {
      setError("项目或版本标识缺失。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        projectResponse,
        itemsResponse,
        versionsResponse,
        quotaLinesResponse,
      ] = await Promise.all([
        apiClient.getProject(projectId),
        apiClient.listBillItems(projectId, versionId),
        apiClient.listBillVersions(projectId),
        apiClient.listProjectQuotaLines(projectId),
      ]);
      const selected = versionsResponse.items.find((version) => version.id === versionId);
      const [candidatesResponse, priceVersionsResponse, feeTemplatesResponse] =
        await Promise.all([
          apiClient.listQuotaSourceCandidates(projectId, {
            disciplineCode: selected?.disciplineCode,
          }),
          apiClient.listPriceVersions({
            disciplineCode: selected?.disciplineCode,
            status: "active",
          }),
          apiClient.listFeeTemplates({
            stageCode: selected?.stageCode,
            status: "active",
          }),
        ]);
      const flatItems = flattenBillItems(itemsResponse.items);
      setProject(projectResponse);
      setItems(itemsResponse.items);
      setVersions(versionsResponse.items);
      setQuotaLines(quotaLinesResponse.items);
      setQuotaCandidates(candidatesResponse.items);
      setPriceVersions(priceVersionsResponse.items);
      setFeeTemplates(feeTemplatesResponse.items);
      setSelectedPriceVersionId(
        projectResponse.defaultPriceVersionId ??
          priceVersionsResponse.items[0]?.id ??
          "",
      );
      setSelectedFeeTemplateId(
        projectResponse.defaultFeeTemplateId ?? feeTemplatesResponse.items[0]?.id ?? "",
      );
      setSelectedBillItemId((current) => current || flatItems[0]?.id || "");
      setSelectedCandidateIds([]);
      setQuotaActionMessage(null);
      setQuotaValidation(null);
      setPricingActionMessage(null);
      setBillItemFilter("");
      setQuotaCandidateFilter("");
      setPriceVersionFilter("");
      setFeeTemplateFilter("");
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "清单页加载失败，请确认 API 可用。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBillItems();
  }, [projectId, versionId]);

  async function handleBatchAddQuotaLines() {
    if (!projectId || !versionId || !selectedBillItemId) {
      return;
    }

    const selectedCandidates = filterQuotaCandidates(
      quotaCandidates,
      quotaCandidateFilter,
    ).filter((candidate) =>
      selectedCandidateIds.includes(candidate.sourceQuotaId),
    );
    if (selectedCandidates.length === 0) {
      setQuotaActionMessage("请选择要添加的定额。");
      return;
    }

    setQuotaActionMessage("正在添加定额...");
    try {
      await apiClient.batchCreateQuotaLines({
        projectId,
        items: selectedCandidates.map((candidate) => ({
          billVersionId: versionId,
          billItemId: selectedBillItemId,
          sourceStandardSetCode: candidate.sourceStandardSetCode,
          sourceQuotaId: candidate.sourceQuotaId,
          sourceSequence: candidate.sourceSequence,
          chapterCode: candidate.chapterCode,
          quotaCode: candidate.quotaCode,
          quotaName: candidate.quotaName,
          unit: candidate.unit,
          quantity: 1,
          laborFee: candidate.laborFee,
          materialFee: candidate.materialFee,
          machineFee: candidate.machineFee,
          contentFactor: 1,
          sourceMode: candidate.sourceMode,
        })),
      });
      const refreshed = await apiClient.listProjectQuotaLines(projectId);
      setQuotaLines(refreshed.items);
      setSelectedCandidateIds([]);
      setQuotaCandidateFilter("");
      setQuotaValidation(null);
      setQuotaActionMessage(`已添加 ${selectedCandidates.length} 条定额。`);
    } catch (mutationError) {
      setQuotaActionMessage(
        mutationError instanceof ApiError
          ? mutationError.message
          : "定额添加失败，请稍后重试。",
      );
    }
  }

  async function handleValidateQuotaLines() {
    if (!projectId) {
      return;
    }

    setQuotaActionMessage("正在校验定额...");
    try {
      const result = await apiClient.validateProjectQuotaLines(projectId);
      setQuotaValidation(result);
      setQuotaActionMessage(
        result.passed ? "定额校验通过。" : `定额校验发现 ${result.issueCount} 个问题。`,
      );
    } catch (mutationError) {
      setQuotaActionMessage(
        mutationError instanceof ApiError
          ? mutationError.message
          : "定额校验失败，请稍后重试。",
      );
    }
  }

  async function handleSavePricingDefaults() {
    if (!projectId) {
      return;
    }

    setPricingActionMessage("正在保存计价配置...");
    try {
      const [priceProject, feeProject] = await Promise.all([
        apiClient.updateProjectDefaultPriceVersion(
          projectId,
          selectedPriceVersionId || null,
        ),
        apiClient.updateProjectDefaultFeeTemplate(projectId, selectedFeeTemplateId || null),
      ]);
      setProject({
        ...feeProject,
        defaultPriceVersionId: priceProject.defaultPriceVersionId,
      });
      setPricingActionMessage("计价配置已保存。");
    } catch (mutationError) {
      setPricingActionMessage(
        mutationError instanceof ApiError
          ? mutationError.message
          : "计价配置保存失败，请稍后重试。",
      );
    }
  }

  async function handleRecalculateVersion() {
    if (!projectId || !versionId) {
      return;
    }

    setPricingActionMessage("正在重算当前版本...");
    try {
      const result = await apiClient.recalculateBillVersion({
        projectId,
        billVersionId: versionId,
        priceVersionId: selectedPriceVersionId || undefined,
        feeTemplateId: selectedFeeTemplateId || undefined,
      });
      await loadBillItems();
      setPricingActionMessage(
        `重算完成：已更新 ${result.recalculatedCount} 条清单项，跳过 ${result.skippedItems.length} 条。`,
      );
    } catch (mutationError) {
      setPricingActionMessage(
        mutationError instanceof ApiError
          ? mutationError.message
          : "当前版本重算失败，请稍后重试。",
      );
    }
  }

  async function handleRecalculateProject() {
    if (!projectId || !selectedVersion) {
      return;
    }

    setPricingActionMessage("正在创建项目重算任务...");
    try {
      const job = await apiClient.recalculateProject({
        projectId,
        stageCode: selectedVersion.stageCode,
        disciplineCode: selectedVersion.disciplineCode,
        priceVersionId: selectedPriceVersionId || undefined,
        feeTemplateId: selectedFeeTemplateId || undefined,
      });
      setPricingActionMessage(`项目重算任务已创建：${job.id}（${job.status}）。`);
    } catch (mutationError) {
      setPricingActionMessage(
        mutationError instanceof ApiError
          ? mutationError.message
          : "项目重算任务创建失败，请稍后重试。",
      );
    }
  }

  async function handleCalculateSelectedItem() {
    if (!projectId || !selectedBillItemId) {
      return;
    }

    setPricingActionMessage("正在计价当前清单项...");
    try {
      await apiClient.calculateBillItem({
        billItemId: selectedBillItemId,
        priceVersionId: selectedPriceVersionId || undefined,
        feeTemplateId: selectedFeeTemplateId || undefined,
      });
      await loadBillItems();
      setPricingActionMessage("当前清单项计价完成。");
    } catch (mutationError) {
      setPricingActionMessage(
        mutationError instanceof ApiError
          ? mutationError.message
          : "当前清单项计价失败，请稍后重试。",
      );
    }
  }

  async function handleManualPricing() {
    if (!projectId || !versionId || !selectedBillItemId) {
      return;
    }

    const normalizedUnitPrice = manualUnitPrice.trim();
    const parsedUnitPrice =
      normalizedUnitPrice === "" ? null : Number(normalizedUnitPrice);
    if (parsedUnitPrice !== null && !Number.isFinite(parsedUnitPrice)) {
      setPricingActionMessage("人工单价必须是数字。");
      return;
    }

    setPricingActionMessage("正在保存人工调价...");
    try {
      await apiClient.updateBillItemManualPricing({
        projectId,
        billVersionId: versionId,
        itemId: selectedBillItemId,
        manualUnitPrice: parsedUnitPrice,
        reason: manualPricingReason,
      });
      await loadBillItems();
      setPricingActionMessage("人工调价已保存。");
    } catch (mutationError) {
      setPricingActionMessage(
        mutationError instanceof ApiError
          ? mutationError.message
          : "人工调价保存失败，请稍后重试。",
      );
    }
  }

  const selectedVersion =
    versions.find((version) => version.id === versionId) ?? null;
  const flatItems = useMemo(() => flattenBillItems(items), [items]);
  const normalizedBillItemFilter = billItemFilter.trim().toLowerCase();
  const filteredFlatItems = useMemo(() => {
    if (!normalizedBillItemFilter) {
      return flatItems;
    }

    return flatItems.filter((item) =>
      [item.code, item.name, item.unit]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedBillItemFilter)),
    );
  }, [flatItems, normalizedBillItemFilter]);
  const selectedBillItem = flatItems.find((item) => item.id === selectedBillItemId) ?? null;
  const filteredQuotaCandidates = useMemo(
    () => filterQuotaCandidates(quotaCandidates, quotaCandidateFilter),
    [quotaCandidateFilter, quotaCandidates],
  );
  const normalizedQuotaCandidateFilter = quotaCandidateFilter.trim().toLowerCase();
  const filteredPriceVersions = useMemo(
    () => filterPriceVersions(priceVersions, priceVersionFilter),
    [priceVersionFilter, priceVersions],
  );
  const filteredFeeTemplates = useMemo(
    () => filterFeeTemplates(feeTemplates, feeTemplateFilter),
    [feeTemplateFilter, feeTemplates],
  );
  const normalizedPriceVersionFilter = priceVersionFilter.trim().toLowerCase();
  const normalizedFeeTemplateFilter = feeTemplateFilter.trim().toLowerCase();
  const visibleQuotaLines = quotaLines.filter((quotaLine) => quotaLine.billVersionId === versionId);
  const selectedItemQuotaLines = selectedBillItem
    ? visibleQuotaLines.filter((quotaLine) => quotaLine.billItemId === selectedBillItem.id)
    : [];
  const breadcrumbs =
    projectId && selectedVersion
      ? buildProjectVersionBreadcrumbs({
          currentLabel: "清单页",
          projectId,
          projectName: project?.name ?? projectId,
          versionLabel: selectedVersion.versionName,
        })
      : null;

  if (loading) {
    return <LoadingState title="正在加载清单页" />;
  }

  if (error) {
    return (
      <ErrorState
        body={error}
        onRetry={() => {
          void loadBillItems();
        }}
      />
    );
  }

  return (
    <div className="page-stack">
      {breadcrumbs ? <AppBreadcrumbs items={breadcrumbs} /> : null}
      <header className="page-header">
        <div>
          <h2 className="page-title">清单页</h2>
          <p className="page-description">
            当前升级为层级表格视图，先把 bill version 切换和 summary 联动打通。
          </p>
          {project ? (
            <p className="page-description">
              当前项目：{project.name}（{project.code}）
            </p>
          ) : null}
        </div>
        {projectId && versionId ? (
          <Link
            className="app-nav-link active"
            to={`/projects/${projectId}/summary?billVersionId=${versionId}`}
          >
            跳转汇总页
          </Link>
        ) : null}
      </header>

      <section className="stat-grid">
        <article className="stat-card">
          <p className="stat-label">清单项数量</p>
          <p className="stat-value">{flatItems.length}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">叶子节点</p>
          <p className="stat-value">{countLeafBillItems(flatItems)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">当前版本</p>
          <p className="stat-value">{selectedVersion?.versionName ?? versionId ?? "-"}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">定额明细</p>
          <p className="stat-value">{visibleQuotaLines.length}</p>
        </article>
      </section>

      {versions.length > 0 ? (
        <section className="panel">
          <div className="page-header">
            <div>
              <h3>版本切换</h3>
              <p className="page-description">
                先支持版本间浏览切换，后续再接更多筛选条件。
              </p>
            </div>
            {versionId ? (
              <BillVersionSelector
                onChange={(billVersionId) => {
                  if (!projectId) {
                    return;
                  }
                  void navigate(
                    `/projects/${projectId}/bill-versions/${billVersionId}/items`,
                  );
                }}
                selectedVersionId={versionId}
                versions={versions}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="page-header">
          <div>
            <h3>计价配置</h3>
            <p className="page-description">
              绑定当前项目默认价目版本与取费模板，并对当前清单版本重算。
            </p>
          </div>
          <div className="button-row">
            <button
              className="primary-button secondary"
              onClick={() => {
                void handleSavePricingDefaults();
              }}
              type="button"
            >
              保存配置
            </button>
            <button
              className="primary-button"
              disabled={!selectedPriceVersionId || !selectedFeeTemplateId}
              onClick={() => {
                void handleCalculateSelectedItem();
              }}
              type="button"
            >
              单项计价
            </button>
            <button
              className="primary-button"
              disabled={!selectedPriceVersionId || !selectedFeeTemplateId}
              onClick={() => {
                void handleRecalculateVersion();
              }}
              type="button"
            >
              重算当前版本
            </button>
            <button
              className="primary-button"
              disabled={!selectedPriceVersionId || !selectedFeeTemplateId}
              onClick={() => {
                void handleRecalculateProject();
              }}
              type="button"
            >
              创建项目重算
            </button>
          </div>
        </div>

        <div className="button-row">
          <label className="form-field">
            筛选价目版本
            <input
              placeholder="名称、编码、地区或专业"
              value={priceVersionFilter}
              onChange={(event) => {
                setPriceVersionFilter(event.target.value);
                setPricingActionMessage(null);
              }}
            />
          </label>
          <button
            className="primary-button secondary"
            disabled={!priceVersionFilter}
            onClick={() => {
              setPriceVersionFilter("");
            }}
            type="button"
          >
            清空价目筛选
          </button>
          <label className="form-field">
            筛选取费模板
            <input
              placeholder="名称、阶段、地区或税制"
              value={feeTemplateFilter}
              onChange={(event) => {
                setFeeTemplateFilter(event.target.value);
                setPricingActionMessage(null);
              }}
            />
          </label>
          <button
            className="primary-button secondary"
            disabled={!feeTemplateFilter}
            onClick={() => {
              setFeeTemplateFilter("");
            }}
            type="button"
          >
            清空取费筛选
          </button>
        </div>

        {normalizedPriceVersionFilter ? (
          <p className="page-description">
            已筛选 {filteredPriceVersions.length}/{priceVersions.length} 个价目版本。
          </p>
        ) : null}
        {normalizedFeeTemplateFilter ? (
          <p className="page-description">
            已筛选 {filteredFeeTemplates.length}/{feeTemplates.length} 个取费模板。
          </p>
        ) : null}

        <div className="form-grid">
          <label className="form-field">
            默认价目版本
            <select
              value={selectedPriceVersionId}
              onChange={(event) => {
                setSelectedPriceVersionId(event.target.value);
                setPricingActionMessage(null);
              }}
            >
              <option value="">未绑定</option>
              {filteredPriceVersions.map((priceVersion) => (
                <option key={priceVersion.id} value={priceVersion.id}>
                  {priceVersion.versionName}（{priceVersion.regionCode} /{" "}
                  {priceVersion.disciplineCode}）
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            默认取费模板
            <select
              value={selectedFeeTemplateId}
              onChange={(event) => {
                setSelectedFeeTemplateId(event.target.value);
                setPricingActionMessage(null);
              }}
            >
              <option value="">未绑定</option>
              {filteredFeeTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.templateName}（{template.stageScope.join(" / ")}）
                </option>
              ))}
            </select>
          </label>
        </div>

        {priceVersions.length === 0 ? (
          <EmptyState
            title="暂无可用价目版本"
            body="当前版本专业下没有可绑定的启用价目版本。"
          />
        ) : null}
        {priceVersions.length > 0 && filteredPriceVersions.length === 0 ? (
          <EmptyState title="没有匹配价目版本" body="请调整名称、编码、地区或专业筛选条件。" />
        ) : null}
        {feeTemplates.length === 0 ? (
          <EmptyState
            title="暂无可用取费模板"
            body="当前版本阶段下没有可绑定的启用取费模板。"
          />
        ) : null}
        {feeTemplates.length > 0 && filteredFeeTemplates.length === 0 ? (
          <EmptyState title="没有匹配取费模板" body="请调整名称、阶段、地区或税制筛选条件。" />
        ) : null}

        {selectedBillItem ? (
          <div className="form-grid">
            <label className="form-field">
              当前清单项
              <select
                value={selectedBillItemId}
                onChange={(event) => {
                  const nextItem = flatItems.find((item) => item.id === event.target.value);
                  setSelectedBillItemId(event.target.value);
                  setManualUnitPrice(
                    nextItem?.manualUnitPrice === undefined ||
                      nextItem.manualUnitPrice === null
                      ? ""
                      : String(nextItem.manualUnitPrice),
                  );
                  setPricingActionMessage(null);
                }}
              >
                {flatItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              人工综合单价
              <input
                min="0"
                step="0.01"
                type="number"
                value={manualUnitPrice}
                onChange={(event) => {
                  setManualUnitPrice(event.target.value);
                  setPricingActionMessage(null);
                }}
              />
            </label>
            <label className="form-field">
              调价原因
              <input
                value={manualPricingReason}
                onChange={(event) => {
                  setManualPricingReason(event.target.value);
                  setPricingActionMessage(null);
                }}
              />
            </label>
            <div className="form-field button-field">
              <span>人工调价</span>
              <button
                className="primary-button secondary"
                disabled={!manualPricingReason.trim()}
                onClick={() => {
                  void handleManualPricing();
                }}
                type="button"
              >
                保存人工价
              </button>
            </div>
          </div>
        ) : null}

        {pricingActionMessage ? (
          <p className="page-description">{pricingActionMessage}</p>
        ) : null}
      </section>

      {items.length === 0 ? (
        <EmptyState
          title="当前版本还没有清单项"
          body="等 bill items 写入后，这里会显示最小清单树和金额摘要。"
        />
      ) : (
        <section className="panel">
          <div className="page-header">
            <div>
              <h3>清单层级表格</h3>
              {normalizedBillItemFilter ? (
                <p className="page-description">
                  已筛选 {filteredFlatItems.length}/{flatItems.length} 项清单。
                </p>
              ) : null}
            </div>
            <div className="button-row">
              <label className="form-field">
                筛选清单项
                <input
                  placeholder="编码、名称或单位"
                  value={billItemFilter}
                  onChange={(event) => {
                    setBillItemFilter(event.target.value);
                  }}
                />
              </label>
              <button
                className="primary-button secondary"
                disabled={!billItemFilter}
                onClick={() => {
                  setBillItemFilter("");
                }}
                type="button"
              >
                清空筛选
              </button>
            </div>
          </div>
          {filteredFlatItems.length === 0 ? (
            <EmptyState title="没有匹配清单项" body="请调整编码、名称或单位筛选条件。" />
          ) : (
            <BillItemsTable items={filteredFlatItems} />
          )}
        </section>
      )}

      {items.length > 0 ? (
        <section className="panel">
          <div className="page-header">
            <div>
              <h3>定额选择器</h3>
              <p className="page-description">
                按当前版本专业默认定额集展示候选定额，可批量添加到选中清单项。
              </p>
              {normalizedQuotaCandidateFilter ? (
                <p className="page-description">
                  已筛选 {filteredQuotaCandidates.length}/{quotaCandidates.length} 条候选定额。
                </p>
              ) : null}
            </div>
            <div className="button-row">
              <label className="form-field">
                筛选候选定额
                <input
                  placeholder="编号、名称、章节或来源"
                  value={quotaCandidateFilter}
                  onChange={(event) => {
                    setQuotaCandidateFilter(event.target.value);
                    setQuotaActionMessage(null);
                  }}
                />
              </label>
              <button
                className="primary-button secondary"
                disabled={!quotaCandidateFilter}
                onClick={() => {
                  setQuotaCandidateFilter("");
                }}
                type="button"
              >
                清空候选筛选
              </button>
              <button
                className="primary-button"
                disabled={!selectedBillItemId || selectedCandidateIds.length === 0}
                onClick={() => {
                  void handleBatchAddQuotaLines();
                }}
                type="button"
              >
                批量添加
              </button>
              <button
                className="primary-button secondary"
                onClick={() => {
                  void handleValidateQuotaLines();
                }}
                type="button"
              >
                校验定额
              </button>
            </div>
          </div>

          <label className="form-field">
            目标清单项
            <select
              value={selectedBillItemId}
              onChange={(event) => {
                setSelectedBillItemId(event.target.value);
                setQuotaActionMessage(null);
              }}
            >
              {flatItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} {item.name}
                </option>
              ))}
            </select>
          </label>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>选择</th>
                  <th>定额编号</th>
                  <th>名称</th>
                  <th>章节</th>
                  <th>单位</th>
                  <th>来源方式</th>
                  <th>来源库/地区</th>
                  <th>匹配说明</th>
                  <th>费用组成</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotaCandidates.map((candidate) => (
                  <tr key={candidate.sourceQuotaId}>
                    <td>
                      <input
                        aria-label={`选择 ${candidate.quotaCode}`}
                        checked={selectedCandidateIds.includes(candidate.sourceQuotaId)}
                        onChange={(event) => {
                          setSelectedCandidateIds((current) =>
                            event.target.checked
                              ? [...current, candidate.sourceQuotaId]
                              : current.filter((id) => id !== candidate.sourceQuotaId),
                          );
                          setQuotaActionMessage(null);
                        }}
                        type="checkbox"
                      />
                    </td>
                    <td>{candidate.quotaCode}</td>
                    <td>{candidate.quotaName}</td>
                    <td>{candidate.chapterCode}</td>
                    <td>{candidate.unit}</td>
                    <td>{candidate.sourceMode}</td>
                    <td>
                      {[candidate.sourceRegion, candidate.sourceDataset]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </td>
                    <td>{candidate.matchReason ?? candidate.workContentSummary ?? "-"}</td>
                    <td>{candidate.resourceCompositionSummary ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {quotaCandidates.length === 0 ? (
            <EmptyState
              title="暂无候选定额"
              body="当前项目专业默认定额集还没有可套用的候选定额。"
            />
          ) : null}
          {quotaCandidates.length > 0 && filteredQuotaCandidates.length === 0 ? (
            <EmptyState title="没有匹配候选定额" body="请调整编号、名称、章节或来源筛选条件。" />
          ) : null}
          {quotaActionMessage ? (
            <p className="page-description">{quotaActionMessage}</p>
          ) : null}
          {quotaValidation && quotaValidation.issues.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>问题</th>
                    <th>清单项</th>
                    <th>定额</th>
                    <th>单位</th>
                  </tr>
                </thead>
                <tbody>
                  {quotaValidation.issues.map((issue) => (
                    <tr key={`${issue.code}-${issue.billItemId}-${issue.quotaLineId ?? "item"}`}>
                      <td>{issue.code}</td>
                      <td>
                        {issue.billItemCode} {issue.billItemName}
                      </td>
                      <td>{issue.quotaCode ?? "-"}</td>
                      <td>
                        {issue.billItemUnit && issue.quotaUnit
                          ? `${issue.billItemUnit} / ${issue.quotaUnit}`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedBillItem ? (
        <section className="panel">
          <h3>已套定额：{selectedBillItem.name}</h3>
          {selectedItemQuotaLines.length === 0 ? (
            <EmptyState title="当前清单项还没有定额" body="可从上方候选定额中选择并批量添加。" />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>定额编号</th>
                    <th>名称</th>
                    <th>单位</th>
                    <th>数量</th>
                    <th>人工费</th>
                    <th>材料费</th>
                    <th>机械费</th>
                    <th>含量系数</th>
                    <th>来源方式</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItemQuotaLines.map((quotaLine) => (
                    <tr key={quotaLine.id}>
                      <td>{quotaLine.quotaCode}</td>
                      <td>{quotaLine.quotaName}</td>
                      <td>{quotaLine.unit}</td>
                      <td>{quotaLine.quantity}</td>
                      <td>{quotaLine.laborFee ?? "-"}</td>
                      <td>{quotaLine.materialFee ?? "-"}</td>
                      <td>{quotaLine.machineFee ?? "-"}</td>
                      <td>{quotaLine.contentFactor}</td>
                      <td>{quotaLine.sourceMode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
