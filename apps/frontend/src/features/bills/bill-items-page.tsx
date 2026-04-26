import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type { BillItem, BillVersion, ProjectListItem } from "../../lib/types";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import { BillVersionSelector } from "../shared/bill-version-selector";
import { AppBreadcrumbs, buildProjectVersionBreadcrumbs } from "../shared/breadcrumbs";
import { BillItemsTable, countLeafBillItems } from "./bill-items-table";

export function BillItemsPage() {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = params.projectId;
  const versionId = params.versionId;
  const [project, setProject] = useState<ProjectListItem | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [versions, setVersions] = useState<BillVersion[]>([]);
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
      const [projectResponse, itemsResponse, versionsResponse] = await Promise.all([
        apiClient.getProject(projectId),
        apiClient.listBillItems(projectId, versionId),
        apiClient.listBillVersions(projectId),
      ]);
      setProject(projectResponse);
      setItems(itemsResponse.items);
      setVersions(versionsResponse.items);
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

  const selectedVersion =
    versions.find((version) => version.id === versionId) ?? null;
  const breadcrumbs =
    projectId && selectedVersion
      ? buildProjectVersionBreadcrumbs({
          currentLabel: "清单页",
          projectId,
          projectName: project?.name ?? projectId,
          versionLabel: selectedVersion.versionName,
        })
      : null;

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
          <p className="stat-value">{items.length}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">叶子节点</p>
          <p className="stat-value">{countLeafBillItems(items)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">当前版本</p>
          <p className="stat-value">{selectedVersion?.versionName ?? versionId ?? "-"}</p>
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

      {items.length === 0 ? (
        <EmptyState
          title="当前版本还没有清单项"
          body="等 bill items 写入后，这里会显示最小清单树和金额摘要。"
        />
      ) : (
        <section className="panel">
          <h3>清单层级表格</h3>
          <BillItemsTable items={items} />
        </section>
      )}
    </div>
  );
}
