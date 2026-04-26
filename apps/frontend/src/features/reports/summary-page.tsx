import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams, useParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type {
  BillVersion,
  ProjectListItem,
  SummaryDetailItem,
  SummaryResponse,
  VersionCompareResponse,
} from "../../lib/types";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import { AppBreadcrumbs, buildProjectVersionBreadcrumbs } from "../shared/breadcrumbs";
import { BillVersionSelector } from "../shared/bill-version-selector";
import {
  buildSummaryPageContext,
  findSelectedBillVersion,
} from "./summary-page-context";
import {
  buildVersionCompareHighlights,
  buildVersionCompareTableRows,
  formatCompareVarianceTone,
} from "./summary-compare";
import { buildSummaryHighlights } from "./summary-highlights";

function formatMoney(value: number | string | null | undefined) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  const normalized = Number(value);
  if (Number.isNaN(normalized)) {
    return String(value);
  }
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized);
}

export function SummaryPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = params.projectId;
  const billVersionId = searchParams.get("billVersionId") ?? undefined;
  const compareBaseBillVersionId =
    searchParams.get("compareBaseBillVersionId") ?? undefined;
  const compareTargetBillVersionId =
    searchParams.get("compareTargetBillVersionId") ?? billVersionId;
  const [project, setProject] = useState<ProjectListItem | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [details, setDetails] = useState<SummaryDetailItem[]>([]);
  const [versions, setVersions] = useState<BillVersion[]>([]);
  const [versionCompare, setVersionCompare] = useState<VersionCompareResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedVersion = useMemo(
    () => findSelectedBillVersion(versions, billVersionId),
    [billVersionId, versions],
  );

  async function loadSummary() {
    if (!projectId) {
      setError("项目标识缺失，无法加载汇总页。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [projectResponse, summaryResponse, detailsResponse, versionsResponse] =
        await Promise.all([
          apiClient.getProject(projectId),
          apiClient.getSummary(projectId, billVersionId),
          apiClient.getSummaryDetails(projectId, billVersionId),
          apiClient.listBillVersions(projectId),
        ]);
      setProject(projectResponse);
      setSummary(summaryResponse);
      setDetails(detailsResponse.items);
      setVersions(versionsResponse.items);

      if (
        compareBaseBillVersionId &&
        compareTargetBillVersionId &&
        compareBaseBillVersionId !== compareTargetBillVersionId
      ) {
        setVersionCompare(
          await apiClient.getVersionCompare(
            projectId,
            compareBaseBillVersionId,
            compareTargetBillVersionId,
          ),
        );
      } else {
        setVersionCompare(null);
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "汇总页加载失败，请确认 API 已启动。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [projectId, billVersionId, compareBaseBillVersionId, compareTargetBillVersionId]);

  if (loading) {
    return <LoadingState title="正在加载汇总页" />;
  }

  if (error) {
    return (
      <ErrorState
        body={error}
        onRetry={() => {
          void loadSummary();
        }}
      />
    );
  }

  if (!summary) {
    return (
      <EmptyState
        title="汇总数据为空"
        body="还没有拿到 summary 结果，请稍后再试。"
      />
    );
  }

  const versionContext =
    projectId && selectedVersion
      ? buildSummaryPageContext({
          projectId,
          billVersionId: selectedVersion.id,
        })
      : null;
  const breadcrumbs =
    projectId && selectedVersion
      ? buildProjectVersionBreadcrumbs({
          currentLabel: "汇总页",
          projectId,
          projectName: project?.name ?? projectId,
          versionLabel: selectedVersion.versionName,
        })
      : null;
  const highlightCards = buildSummaryHighlights(details);
  const compareHighlights = versionCompare
    ? buildVersionCompareHighlights(versionCompare.items)
    : [];
  const compareTableRows = versionCompare
    ? buildVersionCompareTableRows(versionCompare.items)
    : [];

  return (
    <div className="page-stack">
      {breadcrumbs ? <AppBreadcrumbs items={breadcrumbs} /> : null}
      <header className="page-header">
        <div>
          <h2 className="page-title">汇总页</h2>
          <p className="page-description">
            这里先展示最核心的系统值、最终值和偏差摘要，给后续前端联调一个清晰落点。
          </p>
          {project ? (
            <p className="page-description">
              当前项目：{project.name}（{project.code}）
            </p>
          ) : null}
          <p className="page-description">
            {selectedVersion
              ? `当前版本：${selectedVersion.versionName} · ${selectedVersion.stageCode} · ${selectedVersion.disciplineCode}`
              : billVersionId
                ? `当前按版本 ${billVersionId} 过滤，但前端还没拿到对应版本详情。`
                : "当前展示项目级汇总，尚未限定 bill version。"}
          </p>
        </div>
        {projectId ? (
          <Link className="app-nav-link active" to={`/projects/${projectId}`}>
            返回项目详情
          </Link>
        ) : null}
      </header>

      {versions.length > 0 ? (
        <section className="panel">
          <div className="page-header">
            <div>
              <h3>版本上下文</h3>
              <p className="page-description">
                汇总页会跟着 bill version 过滤条件联动，你可以在这里直接切换。
              </p>
            </div>
            <div className="summary-actions">
              {selectedVersion ? (
                <BillVersionSelector
                  onChange={(nextVersionId) => {
                    if (!projectId) {
                      return;
                    }
                    window.history.replaceState(
                      null,
                      "",
                      `/projects/${projectId}/summary?billVersionId=${nextVersionId}`,
                    );
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }}
                  selectedVersionId={selectedVersion.id}
                  versions={versions}
                />
              ) : null}
              {versionContext ? (
                <Link className="app-nav-link active" to={versionContext.billItemsPath}>
                  返回当前版本清单页
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {versions.length > 1 ? (
        <section className="panel">
          <div className="page-header">
            <div>
              <h3>版本对比</h3>
              <p className="page-description">
                先选一个基准版本，再和当前版本做差异比较。
              </p>
            </div>
            <div className="compare-actions">
              <BillVersionSelector
                label="基准版本"
                onChange={(nextBaseId) => {
                  if (!projectId || !compareTargetBillVersionId) {
                    return;
                  }
                  void navigate(
                    `/projects/${projectId}/summary?billVersionId=${compareTargetBillVersionId}&compareBaseBillVersionId=${nextBaseId}&compareTargetBillVersionId=${compareTargetBillVersionId}`,
                  );
                }}
                selectedVersionId={
                  compareBaseBillVersionId ??
                  versions.find((version) => version.id !== compareTargetBillVersionId)?.id ??
                  versions[0]!.id
                }
                versions={versions}
              />
              <BillVersionSelector
                label="对比版本"
                onChange={(nextTargetId) => {
                  if (!projectId) {
                    return;
                  }
                  const nextBaseId =
                    compareBaseBillVersionId ??
                    versions.find((version) => version.id !== nextTargetId)?.id ??
                    nextTargetId;
                  void navigate(
                    `/projects/${projectId}/summary?billVersionId=${nextTargetId}&compareBaseBillVersionId=${nextBaseId}&compareTargetBillVersionId=${nextTargetId}`,
                  );
                }}
                selectedVersionId={
                  compareTargetBillVersionId ??
                  billVersionId ??
                  versions[0]!.id
                }
                versions={versions}
              />
            </div>
          </div>
          {versionCompare ? (
            <div className="compare-summary">
              <p className="page-description">
                基准版本：{versionCompare.baseVersionName}，对比版本：{versionCompare.targetVersionName}。
              </p>
              <p className="page-description">
                共对比 {versionCompare.itemCount} 个清单项，下面按最终值偏差绝对值从高到低展示。
              </p>
              <div className="highlight-grid">
                {compareHighlights.map((item) => (
                  <article className={`highlight-card ${item.tone}`} key={item.itemCode}>
                    <p className="stat-label">{item.itemCode}</p>
                    <h4 className="highlight-title">{item.itemName}</h4>
                    <p className="highlight-variance">{item.finalVarianceLabel}</p>
                    <p className="page-description">
                      {formatCompareVarianceTone(Number(item.finalVarianceLabel.replace(/,/g, "")))}
                    </p>
                  </article>
                ))}
              </div>
              {compareTableRows.length > 0 ? (
                <div className="compare-table-shell">
                  <table className="compare-table">
                    <thead>
                      <tr>
                        <th>清单编码</th>
                        <th>清单名称</th>
                        <th>基准系统值</th>
                        <th>对比系统值</th>
                        <th>系统值偏差</th>
                        <th>基准最终值</th>
                        <th>对比最终值</th>
                        <th>最终值偏差</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareTableRows.map((row) => (
                        <tr key={row.itemCode}>
                          <td className="compare-table-code">{row.itemCode}</td>
                          <td>{row.itemName}</td>
                          <td>{row.baseSystemAmountLabel}</td>
                          <td>{row.targetSystemAmountLabel}</td>
                          <td className={`money-${row.systemTone}`}>
                            {row.systemVarianceAmountLabel}
                          </td>
                          <td>{row.baseFinalAmountLabel}</td>
                          <td>{row.targetFinalAmountLabel}</td>
                          <td className={`money-${row.finalTone}`}>
                            {row.finalVarianceAmountLabel}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="page-description">
              选择两个不同版本后，这里会显示差异最大的条目。
            </p>
          )}
        </section>
      ) : null}

      <section className="summary-grid">
        <article className="stat-card">
          <p className="stat-label">系统值合计</p>
          <p className="stat-value">{formatMoney(summary.totalSystemAmount)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">最终值合计</p>
          <p className="stat-value">{formatMoney(summary.totalFinalAmount)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">偏差金额</p>
          <p
            className={`stat-value ${
              Number(summary.varianceAmount ?? 0) >= 0
                ? "money-positive"
                : "money-negative"
            }`}
          >
            {formatMoney(summary.varianceAmount)}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-label">清单条目数</p>
          <p className="stat-value">{summary.itemCount ?? "-"}</p>
        </article>
      </section>

      {highlightCards.length > 0 ? (
        <section className="panel">
          <h3>偏差重点项</h3>
          <div className="highlight-grid">
            {highlightCards.map((highlight) => (
              <article
                className={`highlight-card ${highlight.tone}`}
                key={highlight.itemId}
              >
                <p className="stat-label">{highlight.itemCode}</p>
                <h4 className="highlight-title">{highlight.itemName}</h4>
                <p className="highlight-variance">{highlight.varianceLabel}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {details.length === 0 ? (
        <EmptyState
          title="暂无偏差明细"
          body="当前项目还没有可展示的 summary detail 数据。"
        />
      ) : (
        <section className="panel">
          <h3>偏差明细 Top 10</h3>
          <div className="bill-list">
            {details.map((detail) => (
              <article className="bill-link" key={detail.itemId}>
                <h3>
                  {detail.itemCode} · {detail.itemName}
                </h3>
                <div className="bill-meta">
                  <span>系统值 {formatMoney(detail.systemAmount)}</span>
                  <span>最终值 {formatMoney(detail.finalAmount)}</span>
                  <span>偏差 {formatMoney(detail.varianceAmount)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
