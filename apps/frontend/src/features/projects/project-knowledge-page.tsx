import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { apiClient, ApiError } from "../../lib/api";
import type {
  KnowledgeEntry,
  KnowledgeEntryListResponse,
  MemoryEntry,
  MemoryEntryListResponse,
  ProjectWorkspace,
} from "../../lib/types";
import { AppBreadcrumbs } from "../shared/breadcrumbs";
import { EmptyState } from "../shared/empty-state";
import { ErrorState } from "../shared/error-state";
import { LoadingState } from "../shared/loading-state";
import { formatProjectDateTime } from "./project-date-utils";

type ProjectKnowledgeState = {
  workspace: ProjectWorkspace;
  knowledge: KnowledgeEntryListResponse;
  memory: MemoryEntryListResponse;
};

type KnowledgeFilters = {
  q: string;
  sourceType: string;
  sourceAction: string;
  stageCode: string;
  subjectType: string;
  subjectId: string;
  limit: string;
};

const defaultFilters: KnowledgeFilters = {
  q: "",
  sourceType: "",
  sourceAction: "",
  stageCode: "",
  subjectType: "",
  subjectId: "",
  limit: "50",
};

export function ProjectKnowledgePage() {
  const params = useParams();
  const projectId = params.projectId;
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<KnowledgeFilters>(() =>
    readFilters(searchParams),
  );
  const [state, setState] = useState<ProjectKnowledgeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeQuery = useMemo(() => readFilters(searchParams), [searchParams]);

  async function loadKnowledge() {
    if (!projectId) {
      setError("项目标识缺失，无法加载知识库。");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const limit = Number(activeQuery.limit);
      const knowledgeRequest = activeQuery.q
        ? apiClient.searchKnowledgeEntries(projectId, {
            q: activeQuery.q,
            sourceType: activeQuery.sourceType,
            stageCode: activeQuery.stageCode,
            limit,
          })
        : apiClient.listKnowledgeEntries(projectId, {
            sourceType: activeQuery.sourceType,
            sourceAction: activeQuery.sourceAction,
            stageCode: activeQuery.stageCode,
            limit,
          });

      const [workspace, knowledge, memory] = await Promise.all([
        apiClient.getProjectWorkspace(projectId),
        knowledgeRequest,
        apiClient.listMemoryEntries(projectId, {
          subjectType: activeQuery.subjectType,
          subjectId: activeQuery.subjectId,
          stageCode: activeQuery.stageCode,
          limit,
        }),
      ]);

      setState({
        workspace,
        knowledge,
        memory,
      });
    } catch (fetchError) {
      setError(
        fetchError instanceof ApiError
          ? fetchError.message
          : "知识与记忆加载失败，请检查 API 连通性。",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFilters(readFilters(searchParams));
  }, [searchParams]);

  useEffect(() => {
    void loadKnowledge();
  }, [projectId, activeQuery]);

  function updateFilter(key: keyof KnowledgeFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyFilters() {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) {
        next.set(key, value.trim());
      }
    }
    setSearchParams(next);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setSearchParams(new URLSearchParams());
  }

  if (loading && !state) {
    return <LoadingState title="正在加载知识与记忆" />;
  }

  if (error && !state) {
    return <ErrorState body={error} onRetry={loadKnowledge} title="知识库加载失败" />;
  }

  if (!state || !projectId) {
    return <EmptyState title="没有知识记录" body="当前项目暂无可展示的知识与记忆。" />;
  }

  return (
    <div className="page-stack">
      <AppBreadcrumbs
        items={[
          {
            label: "项目工作台",
            to: "/projects",
          },
          {
            label: state.workspace.project.name,
            to: `/projects/${projectId}`,
          },
          {
            label: "知识与记忆",
            to: null,
          },
        ]}
      />

      <header className="page-header">
        <div>
          <h1 className="page-title">知识与记忆</h1>
          <p className="page-description">
            {state.workspace.project.name} · 知识 {state.knowledge.summary.totalCount} 条 · 记忆{" "}
            {state.memory.summary.totalCount} 条
          </p>
        </div>
        <Link className="app-nav-link active" to={`/projects/${projectId}`}>
          返回项目工作台
        </Link>
      </header>

      <section className="panel">
        <h2>筛选条件</h2>
        <div className="form-grid">
          <label className="form-field">
            关键词
            <input
              aria-label="关键词"
              onChange={(event) => updateFilter("q", event.target.value)}
              placeholder="偏差、审核、定额"
              value={filters.q}
            />
          </label>
          <label className="form-field">
            来源类型
            <input
              aria-label="来源类型"
              onChange={(event) => updateFilter("sourceType", event.target.value)}
              placeholder="audit_log"
              value={filters.sourceType}
            />
          </label>
          <label className="form-field">
            来源动作
            <input
              aria-label="来源动作"
              onChange={(event) => updateFilter("sourceAction", event.target.value)}
              placeholder="reject"
              value={filters.sourceAction}
            />
          </label>
          <label className="form-field">
            阶段
            <input
              aria-label="阶段"
              onChange={(event) => updateFilter("stageCode", event.target.value)}
              placeholder="estimate"
              value={filters.stageCode}
            />
          </label>
          <label className="form-field">
            记忆主体类型
            <input
              aria-label="记忆主体类型"
              onChange={(event) => updateFilter("subjectType", event.target.value)}
              placeholder="project"
              value={filters.subjectType}
            />
          </label>
          <label className="form-field">
            记忆主体 ID
            <input
              aria-label="记忆主体 ID"
              onChange={(event) => updateFilter("subjectId", event.target.value)}
              placeholder="project-001"
              value={filters.subjectId}
            />
          </label>
          <label className="form-field">
            数量
            <select
              aria-label="数量"
              onChange={(event) => updateFilter("limit", event.target.value)}
              value={filters.limit}
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
        <div className="button-row">
          <button className="primary-button secondary" onClick={resetFilters} type="button">
            清空
          </button>
          <button className="primary-button" onClick={applyFilters} type="button">
            应用筛选
          </button>
        </div>
      </section>

      <section className="detail-grid">
        <article className="panel">
          <h2>知识条目</h2>
          <p className="page-description">
            来源类型：{formatCountMap(state.knowledge.summary.sourceTypeCounts)}
          </p>
          {state.knowledge.items.length > 0 ? (
            <div className="project-list">
              {state.knowledge.items.map((entry) => (
                <KnowledgeEntryCard entry={entry} key={entry.id} />
              ))}
            </div>
          ) : (
            <EmptyState title="没有匹配知识" body="当前筛选条件下没有知识条目。" />
          )}
        </article>

        <article className="panel">
          <h2>项目记忆</h2>
          <p className="page-description">
            主体类型：{formatCountMap(state.memory.summary.subjectTypeCounts)}
          </p>
          {state.memory.items.length > 0 ? (
            <div className="project-list">
              {state.memory.items.map((entry) => (
                <MemoryEntryCard entry={entry} key={entry.id} />
              ))}
            </div>
          ) : (
            <EmptyState title="没有匹配记忆" body="当前筛选条件下没有项目记忆。" />
          )}
        </article>
      </section>
    </div>
  );
}

function KnowledgeEntryCard(props: { entry: KnowledgeEntry }) {
  return (
    <article className="project-link">
      <h3>{props.entry.title}</h3>
      <p className="page-description">{props.entry.summary}</p>
      <p className="page-description">
        {props.entry.sourceType} · {props.entry.sourceAction}
        {props.entry.stageCode ? ` · ${props.entry.stageCode}` : ""} ·{" "}
        {formatProjectDateTime(props.entry.createdAt)}
      </p>
      {props.entry.tags.length > 0 ? (
        <ul className="inline-list">
          {props.entry.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function MemoryEntryCard(props: { entry: MemoryEntry }) {
  return (
    <article className="project-link">
      <h3>{props.entry.memoryKey}</h3>
      <p className="page-description">{props.entry.content}</p>
      <p className="page-description">
        {props.entry.subjectType} · {props.entry.subjectId}
        {props.entry.stageCode ? ` · ${props.entry.stageCode}` : ""} ·{" "}
        {formatProjectDateTime(props.entry.createdAt)}
      </p>
    </article>
  );
}

function readFilters(searchParams: URLSearchParams): KnowledgeFilters {
  return {
    q: searchParams.get("q") ?? defaultFilters.q,
    sourceType: searchParams.get("sourceType") ?? defaultFilters.sourceType,
    sourceAction: searchParams.get("sourceAction") ?? defaultFilters.sourceAction,
    stageCode: searchParams.get("stageCode") ?? defaultFilters.stageCode,
    subjectType: searchParams.get("subjectType") ?? defaultFilters.subjectType,
    subjectId: searchParams.get("subjectId") ?? defaultFilters.subjectId,
    limit: searchParams.get("limit") ?? defaultFilters.limit,
  };
}

function formatCountMap(counts: Record<string, number>) {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "暂无";
  }

  return entries.map(([key, value]) => `${key} ${value}`).join("，");
}
