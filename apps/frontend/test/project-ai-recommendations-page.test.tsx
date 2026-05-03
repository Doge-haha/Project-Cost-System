import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { formatProjectDateTime } from "../src/features/projects/project-date-utils";
import { ProjectAiRecommendationsPage } from "../src/features/projects/project-ai-recommendations-page";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createErrorResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function renderPage(initialEntry = "/projects/project-001/ai-recommendations") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/projects/:projectId/ai-recommendations"
          element={<ProjectAiRecommendationsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectAiRecommendationsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    fetchMock.mockReset();
  });

  test("renders recommendations and accepts a generated item after confirmation", async () => {
    let recommendationStatus = "generated";

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse({
          items: [
            {
              id: "ai-recommendation-001",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "bill_item",
              resourceId: "bill-item-001",
              recommendationType: "quota_recommendation",
              inputPayload: {
                aiProvider: {
                  provider: "mock-provider",
                  model: "mock-model-v1",
                },
              },
              outputPayload: {
                quotaName: "挖土方",
                reason: "清单名称匹配",
                aiAssistTraceId: "ai-trace-001",
                aiResponseSummary: {
                  payloadKeys: ["quotaName", "reason"],
                  valueCount: 2,
                },
              },
              status: recommendationStatus,
              createdBy: "engineer-001",
              handledBy: recommendationStatus === "accepted" ? "engineer-001" : null,
              handledAt:
                recommendationStatus === "accepted"
                  ? "2026-04-18T11:05:00.000Z"
                  : null,
              statusReason:
                recommendationStatus === "accepted" ? "人工确认接受" : null,
              createdAt: "2026-04-18T11:00:00.000Z",
              updatedAt: "2026-04-18T11:00:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              generated: recommendationStatus === "generated" ? 1 : 0,
              accepted: recommendationStatus === "accepted" ? 1 : 0,
              ignored: 0,
              expired: 0,
            },
            typeCounts: {
              bill_recommendation: 0,
              quota_recommendation: 1,
              variance_warning: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/ai/recommendations/ai-recommendation-001/accept") {
        expect(init?.method).toBe("POST");
        recommendationStatus = "accepted";
        return createJsonResponse({
          id: "ai-recommendation-001",
          projectId: "project-001",
          stageCode: "estimate",
          disciplineCode: "building",
          resourceType: "bill_item",
          resourceId: "bill-item-001",
          recommendationType: "quota_recommendation",
          inputPayload: {},
          outputPayload: {
            quotaName: "挖土方",
            reason: "清单名称匹配",
          },
          status: "accepted",
          createdBy: "engineer-001",
          handledBy: "engineer-001",
          handledAt: "2026-04-18T11:05:00.000Z",
          statusReason: "人工确认接受",
          createdAt: "2026-04-18T11:00:00.000Z",
          updatedAt: "2026-04-18T11:05:00.000Z",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AI 推荐" })).toBeInTheDocument();
    });

    expect(screen.getByText("新点造价项目 · 待处理 1 条 · 共 1 条")).toBeInTheDocument();
    expect(screen.getByText("定额推荐 · 待处理")).toBeInTheDocument();
    expect(screen.getByText("清单名称匹配 · 挖土方")).toBeInTheDocument();
    expect(screen.getByText("追溯 ai-trace-001 · 输出字段 2")).toBeInTheDocument();
    expect(screen.getByText("来源 mock-provider / mock-model-v1")).toBeInTheDocument();
    expect(screen.getByText("生成人 engineer-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "接受" }));

    expect(screen.getByRole("dialog", { name: "确认接受 AI 推荐" })).toBeInTheDocument();
    expect(
      screen.getByText("确认接受后，系统会按该推荐写入正式业务链并保留审计记录。"),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/v1/ai/recommendations/ai-recommendation-001/accept"),
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "确认接受" }));

    await waitFor(() => {
      expect(screen.getByText("定额推荐已接受。")).toBeInTheDocument();
    });
    expect(screen.getByText("新点造价项目 · 待处理 0 条 · 共 1 条")).toBeInTheDocument();
    expect(screen.getByText("定额推荐 · 已接受")).toBeInTheDocument();
    expect(screen.getByText("处理人 engineer-001 · 原因 人工确认接受")).toBeInTheDocument();
    expect(
      screen.getByText(`处理时间 ${formatProjectDateTime("2026-04-18T11:05:00.000Z")}`),
    ).toBeInTheDocument();
  });

  test("removes handled recommendation from generated status filter", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse({
          items: [
            {
              id: "ai-recommendation-001",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "bill_item",
              resourceId: "bill-item-001",
              recommendationType: "quota_recommendation",
              inputPayload: {},
              outputPayload: {
                quotaName: "挖土方",
                reason: "清单名称匹配",
              },
              status: "generated",
              createdBy: "engineer-001",
              handledBy: null,
              handledAt: null,
              statusReason: null,
              createdAt: "2026-04-18T11:00:00.000Z",
              updatedAt: "2026-04-18T11:00:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              generated: 1,
              accepted: 0,
              ignored: 0,
              expired: 0,
            },
            typeCounts: {
              bill_recommendation: 0,
              quota_recommendation: 1,
              variance_warning: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/ai/recommendations/ai-recommendation-001/ignore") {
        expect(init?.method).toBe("POST");
        return createJsonResponse({
          id: "ai-recommendation-001",
          projectId: "project-001",
          stageCode: "estimate",
          disciplineCode: "building",
          resourceType: "bill_item",
          resourceId: "bill-item-001",
          recommendationType: "quota_recommendation",
          inputPayload: {},
          outputPayload: {
            quotaName: "挖土方",
            reason: "清单名称匹配",
          },
          status: "ignored",
          createdBy: "engineer-001",
          handledBy: "engineer-001",
          handledAt: "2026-04-18T11:05:00.000Z",
          statusReason: "人工确认忽略",
          createdAt: "2026-04-18T11:00:00.000Z",
          updatedAt: "2026-04-18T11:05:00.000Z",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage("/projects/project-001/ai-recommendations?status=generated");

    await waitFor(() => {
      expect(screen.getByText("定额推荐 · 待处理")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "忽略" }));

    await waitFor(() => {
      expect(screen.getByText("定额推荐已忽略。")).toBeInTheDocument();
    });
    expect(screen.getByText("没有匹配推荐")).toBeInTheDocument();
    expect(screen.queryByText("定额推荐 · 已忽略")).not.toBeInTheDocument();
  });

  test("groups recommendations by resource type and highlights expired items", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse({
          items: [
            {
              id: "ai-recommendation-001",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "bill_item",
              resourceId: "bill-item-001",
              recommendationType: "bill_recommendation",
              inputPayload: {},
              outputPayload: {
                itemName: "土方工程",
                reason: "历史清单匹配",
              },
              status: "generated",
              createdBy: "engineer-001",
              handledBy: null,
              handledAt: null,
              statusReason: null,
              createdAt: "2026-04-18T11:00:00.000Z",
              updatedAt: "2026-04-18T11:00:00.000Z",
            },
            {
              id: "ai-recommendation-002",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "bill_item",
              resourceId: "bill-item-002",
              recommendationType: "variance_warning",
              inputPayload: {},
              outputPayload: {
                warning: "最终金额偏差超过阈值",
              },
              status: "expired",
              createdBy: "engineer-001",
              handledBy: "system",
              handledAt: "2026-04-18T11:30:00.000Z",
              statusReason: "上游清单版本已变化",
              createdAt: "2026-04-18T11:10:00.000Z",
              updatedAt: "2026-04-18T11:30:00.000Z",
            },
            {
              id: "ai-recommendation-003",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "quota_line",
              resourceId: "quota-line-001",
              recommendationType: "quota_recommendation",
              inputPayload: {},
              outputPayload: {
                quotaName: "挖土方",
                reason: "清单名称匹配",
              },
              status: "generated",
              createdBy: "engineer-001",
              handledBy: null,
              handledAt: null,
              statusReason: null,
              createdAt: "2026-04-18T11:20:00.000Z",
              updatedAt: "2026-04-18T11:20:00.000Z",
            },
          ],
          summary: {
            totalCount: 3,
            statusCounts: {
              generated: 2,
              accepted: 0,
              ignored: 0,
              expired: 1,
            },
            typeCounts: {
              bill_recommendation: 1,
              quota_recommendation: 1,
              variance_warning: 1,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("资源 bill_item · 2 条")).toBeInTheDocument();
    });
    expect(screen.getByText("资源 quota_line · 1 条")).toBeInTheDocument();
    expect(screen.getByText("偏差预警 · 已失效")).toBeInTheDocument();
    expect(screen.getByText("已失效 · 不再建议执行")).toBeInTheDocument();
    expect(screen.getByText("处理人 system · 原因 上游清单版本已变化")).toBeInTheDocument();
  });

  test("loads and saves variance warning thresholds", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse(createRecommendationListResponse([]));
      }

      if (url.pathname === "/v1/projects/project-001/ai/variance-warning-thresholds") {
        if (init?.method === "PUT") {
          expect(JSON.parse(String(init.body))).toEqual({
            stageCode: "estimate",
            disciplineCode: "building",
            thresholdAmount: 8000,
            thresholdRate: 0.12,
          });
          return createJsonResponse({
            id: "threshold-002",
            projectId: "project-001",
            stageCode: "estimate",
            disciplineCode: "building",
            thresholdAmount: 8000,
            thresholdRate: 0.12,
            createdAt: "2026-04-18T12:00:00.000Z",
            updatedAt: "2026-04-18T12:00:00.000Z",
          });
        }

        return createJsonResponse({
          items: [
            {
              id: "threshold-001",
              projectId: "project-001",
              stageCode: null,
              disciplineCode: null,
              thresholdAmount: 5000,
              thresholdRate: 0.08,
              createdAt: "2026-04-18T11:00:00.000Z",
              updatedAt: "2026-04-18T11:00:00.000Z",
            },
          ],
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("全部阶段 · 全部专业 · 金额 5000 · 比率 8%")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole("combobox", { name: "阈值阶段" }), {
      target: { value: "estimate" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "阈值专业" }), {
      target: { value: "building" },
    });
    fireEvent.change(screen.getByLabelText("金额阈值"), {
      target: { value: "8000" },
    });
    fireEvent.change(screen.getByLabelText("比率阈值"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存阈值" }));

    await waitFor(() => {
      expect(screen.getByText("阈值配置已保存。")).toBeInTheDocument();
    });
    expect(screen.getByText("estimate · building · 金额 8000 · 比率 12%")).toBeInTheDocument();
  });

  test("submits async job form and refreshes recommendations when job completes", async () => {
    let jobStatus: "queued" | "completed" = "queued";
    let jobSubmitted = false;
    let recommendationItems: unknown[] = [];

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(
          createWorkspaceWithBillVersion("bill-version-001", "估算版 V1"),
        );
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse(createRecommendationListResponse(recommendationItems));
      }

      if (url.pathname === "/v1/projects/project-001/ai/variance-warning-thresholds") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/ai/recommendation-jobs") {
        expect(init?.method).toBe("POST");
        jobSubmitted = true;
        expect(JSON.parse(String(init?.body))).toMatchObject({
          projectId: "project-001",
          recommendationType: "quota_recommendation",
          resourceType: "bill_item",
          resourceId: "bill-item-001",
          billVersionId: "bill-version-001",
          limit: 5,
        });
        return createJsonResponse({
          job: createAiRecommendationJob(jobStatus),
        });
      }

      if (url.pathname === "/v1/jobs") {
        if (!jobSubmitted) {
          return createJsonResponse({
            items: [],
            summary: {
              totalCount: 0,
              statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 },
              jobTypeCounts: {},
            },
          });
        }
        if (jobSubmitted && jobStatus === "queued") {
          jobStatus = "completed";
          recommendationItems = [
            createRecommendation({
              id: "ai-recommendation-async",
              recommendationType: "quota_recommendation",
              outputPayload: { quotaName: "挖土方", reason: "任务生成" },
            }),
          ];
        }
        return createJsonResponse({
          items: [createAiRecommendationJob(jobStatus)],
          summary: {
            totalCount: 1,
            statusCounts: { queued: 0, processing: 0, completed: 1, failed: 0 },
            jobTypeCounts: { ai_recommendation: 1 },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "生成推荐" })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("生成类型"), {
      target: { value: "quota_recommendation" },
    });
    fireEvent.change(screen.getByLabelText("目标版本"), {
      target: { value: "bill-version-001" },
    });
    fireEvent.change(screen.getByLabelText("目标资源类型"), {
      target: { value: "bill_item" },
    });
    fireEvent.change(screen.getByLabelText("目标资源 ID"), {
      target: { value: "bill-item-001" },
    });
    fireEvent.change(screen.getByLabelText("生成数量"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成推荐" }));

    await waitFor(() => {
      expect(screen.getByText("已提交异步推荐任务 background-job-001。")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("AI 推荐任务已完成，列表已刷新。")).toBeInTheDocument();
    }, { timeout: 3500 });
    expect(screen.getByText("任务生成 · 挖土方")).toBeInTheDocument();
  });

  test("omits async job limit when the input is cleared", async () => {
    let submittedBody: Record<string, unknown> | null = null;

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(
          createWorkspaceWithBillVersion("bill-version-001", "估算版 V1"),
        );
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse(createRecommendationListResponse([]));
      }

      if (url.pathname === "/v1/projects/project-001/ai/variance-warning-thresholds") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: { queued: 0, processing: 0, completed: 0, failed: 0 },
            jobTypeCounts: {},
          },
        });
      }

      if (url.pathname === "/v1/ai/recommendation-jobs") {
        submittedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return createJsonResponse({
          job: createAiRecommendationJob("queued"),
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "生成推荐" })).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("生成数量"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "生成推荐" }));

    await waitFor(() => {
      expect(submittedBody).not.toBeNull();
    });
    expect(submittedBody).not.toHaveProperty("limit");
  });

  test("shows provider diagnostics and telemetry alerts", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse(createRecommendationListResponse([]));
      }

      if (url.pathname === "/v1/projects/project-001/ai/variance-warning-thresholds") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/jobs") {
        return createJsonResponse({
          items: [
            {
              ...createAiRecommendationJob("completed"),
              result: {
                createdCount: 1,
                telemetry: { durationMs: 12000, retryCount: 1 },
              },
            },
            {
              ...createAiRecommendationJob("failed"),
              id: "background-job-002",
              result: {
                providerFailureSummary: {
                  durationMs: 8000,
                  retryCount: 2,
                },
              },
              errorMessage: "AI provider response is invalid",
            },
          ],
          summary: {
            totalCount: 2,
            statusCounts: { queued: 0, processing: 0, completed: 1, failed: 1 },
            jobTypeCounts: { ai_recommendation: 2 },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/provider-telemetry") {
        return createJsonResponse({
          totalCount: 2,
          successCount: 1,
          failureCount: 1,
          averageDurationMs: 10000,
          p95DurationMs: 12000,
          maxRetryCount: 2,
          consecutiveFailureCount: 0,
          groups: [
            {
              provider: "openai_compatible",
              model: "cost-model-v1",
              totalCount: 2,
              successCount: 1,
              failureCount: 1,
              averageDurationMs: 10000,
              p95DurationMs: 12000,
              maxRetryCount: 2,
              consecutiveFailureCount: 0,
            },
          ],
          alerts: [
            "运维告警：最近 1 个 Provider 任务失败。",
            "运维告警：Provider P95 耗时 12000ms，已超过 10000ms。",
            "运维提示：最近最大重试次数 2。",
          ],
        });
      }

      if (url.pathname === "/v1/ai/provider-health") {
        return createJsonResponse({
          provider: "openai_compatible",
          model: "cost-model-v1",
          configured: true,
          healthy: true,
          message: "ok",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Provider 诊断" })).toBeInTheDocument();
    });

    expect(
      screen.getByText("最近任务 2 个 · 成功 1 个 · 失败 1 个 · 平均耗时 10000ms · P95 12000ms · 最大重试 2"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("运维告警：最近 1 个 Provider 任务失败。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("运维告警：Provider P95 耗时 12000ms，已超过 10000ms。"),
    ).toBeInTheDocument();
    expect(screen.getByText("运维提示：最近最大重试次数 2。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "检查 Provider" }));

    await waitFor(() => {
      expect(screen.getByText("Provider 连通性正常。")).toBeInTheDocument();
    });
    expect(
      screen.getByText("openai_compatible / cost-model-v1 · 已配置 · 健康 · ok"),
    ).toBeInTheDocument();
  });

  test("confirms rollback before calling rollback API", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse(
          createRecommendationListResponse([
            createRecommendation({
              status: "accepted",
              handledBy: "engineer-001",
              handledAt: "2026-04-18T11:05:00.000Z",
              statusReason: "人工确认接受",
              outputPayload: {
                quotaName: "挖土方",
                acceptedChanges: [
                  {
                    action: "create",
                    resourceType: "quota_line",
                    resourceId: "quota-line-001",
                    label: "010101 挖土方",
                    rollbackSupported: true,
                  },
                ],
              },
            }),
          ]),
        );
      }

      if (url.pathname === "/v1/projects/project-001/ai/variance-warning-thresholds") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/ai/recommendations/ai-recommendation-001/rollback") {
        expect(init?.method).toBe("POST");
        return createJsonResponse(
          createRecommendation({
            status: "rolled_back",
            handledBy: "engineer-001",
            handledAt: "2026-04-18T11:06:00.000Z",
            statusReason: "人工撤销已接受推荐",
            outputPayload: {
              quotaName: "挖土方",
              acceptedChanges: [
                {
                  action: "create",
                  resourceType: "quota_line",
                  resourceId: "quota-line-001",
                  label: "010101 挖土方",
                  rollbackSupported: true,
                },
              ],
              rollback: { changes: [] },
            },
          }),
        );
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("定额推荐 · 已接受")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "撤销接受" }));
    expect(screen.getByRole("dialog", { name: "确认撤销 AI 推荐" })).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes("/rollback")),
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));

    await waitFor(() => {
      expect(screen.getByText("已回滚该推荐接受产生的业务变更。")).toBeInTheDocument();
    });
    expect(screen.getByText("定额推荐 · 已回滚")).toBeInTheDocument();
  });

  test("maps rollback blocked reasons to actionable copy", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse(
          createRecommendationListResponse([
            createRecommendation({
              status: "accepted",
              handledBy: "engineer-001",
              handledAt: "2026-04-18T11:05:00.000Z",
              statusReason: "人工确认接受",
              outputPayload: {
                quotaName: "挖土方",
                acceptedChanges: [
                  {
                    action: "create",
                    resourceType: "bill_item",
                    resourceId: "bill-item-002",
                    label: "A-002 回填土",
                    rollbackSupported: true,
                  },
                ],
              },
            }),
          ]),
        );
      }

      if (url.pathname === "/v1/projects/project-001/ai/variance-warning-thresholds") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/ai/recommendations/ai-recommendation-001/rollback") {
        expect(init?.method).toBe("POST");
        return createErrorResponse(409, {
          error: {
            code: "AI_RECOMMENDATION_ROLLBACK_BLOCKED",
            message:
              "Accepted recommendation cannot be rolled back automatically; please review and handle the business data manually",
            details: {
              reason: "resource_has_quota_lines",
              resourceType: "bill_item",
              resourceId: "bill-item-002",
              label: "A-002 回填土",
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("定额推荐 · 已接受")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "撤销接受" }));
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "无法自动撤销：清单下存在定额行（bill_item · bill-item-002 · A-002 回填土），请人工核对后处理。",
        ),
      ).toBeInTheDocument();
    });
  });

  test("opens recommendation input context preview", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse({
          items: [
            {
              id: "ai-recommendation-001",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "bill_item",
              resourceId: "bill-item-001",
              recommendationType: "bill_recommendation",
              inputPayload: {},
              outputPayload: {
                itemName: "土方工程",
                reason: "历史清单匹配",
              },
              status: "generated",
              createdBy: "engineer-001",
              handledBy: null,
              handledAt: null,
              statusReason: null,
              createdAt: "2026-04-18T11:00:00.000Z",
              updatedAt: "2026-04-18T11:00:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              generated: 1,
              accepted: 0,
              ignored: 0,
              expired: 0,
            },
            typeCounts: {
              bill_recommendation: 1,
              quota_recommendation: 0,
              variance_warning: 0,
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendation-context") {
        expect(url.searchParams.get("recommendationType")).toBe("bill_recommendation");
        expect(url.searchParams.get("resourceType")).toBe("bill_item");
        expect(url.searchParams.get("resourceId")).toBe("bill-item-001");
        expect(url.searchParams.get("stageCode")).toBe("estimate");
        expect(url.searchParams.get("disciplineCode")).toBe("building");
        return createJsonResponse({
          project: { id: "project-001", name: "新点造价项目" },
          currentStage: "estimate",
          targetResource: { id: "bill-item-001", name: "土方工程" },
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/variance-warning-thresholds") {
        return createJsonResponse({ items: [] });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("清单推荐 · 待处理")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "预览上下文" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "AI 输入上下文预览" })).toBeInTheDocument();
    });
    expect(screen.getByText("当前阶段")).toBeInTheDocument();
    expect(screen.getByText("estimate")).toBeInTheDocument();
    expect(screen.getByText("目标资源")).toBeInTheDocument();
    expect(screen.getByText("土方工程")).toBeInTheDocument();
  });

  test("shows enriched expired recommendation reason", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse({
          items: [
            {
              id: "ai-recommendation-002",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "bill_item",
              resourceId: "bill-item-002",
              recommendationType: "variance_warning",
              inputPayload: {
                staleReason: {
                  kind: "price_version_changed",
                  previousVersionId: "price-v1",
                  currentVersionId: "price-v2",
                },
              },
              outputPayload: {
                warning: "最终金额偏差超过阈值",
              },
              status: "expired",
              createdBy: "engineer-001",
              handledBy: "system",
              handledAt: "2026-04-18T11:30:00.000Z",
              statusReason: "价目版本变化，偏差预警已失效",
              createdAt: "2026-04-18T11:10:00.000Z",
              updatedAt: "2026-04-18T11:30:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              generated: 0,
              accepted: 0,
              ignored: 0,
              expired: 1,
            },
            typeCounts: {
              bill_recommendation: 0,
              quota_recommendation: 0,
              variance_warning: 1,
            },
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/ai/variance-warning-thresholds") {
        return createJsonResponse({ items: [] });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("偏差预警 · 已失效")).toBeInTheDocument();
    });
    expect(screen.getByText("失效原因 价目版本变化，偏差预警已失效")).toBeInTheDocument();
    expect(screen.getByText("版本 price-v1 → price-v2")).toBeInTheDocument();
  });

  test("hides generated recommendation actions for read-only users", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(
          createWorkspace({
            roleCode: "reviewer",
            roleLabel: "审核人",
            canEditProject: false,
          }),
        );
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse({
          items: [
            {
              id: "ai-recommendation-001",
              projectId: "project-001",
              stageCode: "estimate",
              disciplineCode: "building",
              resourceType: "bill_item",
              resourceId: "bill-item-001",
              recommendationType: "quota_recommendation",
              inputPayload: {},
              outputPayload: {
                quotaName: "挖土方",
                reason: "清单名称匹配",
              },
              status: "generated",
              createdBy: "engineer-001",
              handledBy: null,
              handledAt: null,
              statusReason: null,
              createdAt: "2026-04-18T11:20:00.000Z",
              updatedAt: "2026-04-18T11:20:00.000Z",
            },
          ],
          summary: {
            totalCount: 1,
            statusCounts: {
              generated: 1,
              accepted: 0,
              ignored: 0,
              expired: 0,
            },
            typeCounts: {
              bill_recommendation: 0,
              quota_recommendation: 1,
              variance_warning: 0,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("定额推荐 · 待处理")).toBeInTheDocument();
    });
    expect(screen.getByText("当前用户仅可查看推荐，不能接受或忽略。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "接受" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "忽略" })).not.toBeInTheDocument();
  });

  test("applies recommendation filters", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse(createWorkspace());
      }

      if (url.pathname === "/v1/projects/project-001/ai/recommendations") {
        return createJsonResponse({
          items: [],
          summary: {
            totalCount: 0,
            statusCounts: {
              generated: 0,
              accepted: 0,
              ignored: 0,
              expired: 0,
            },
            typeCounts: {
              bill_recommendation: 0,
              quota_recommendation: 0,
              variance_warning: 0,
            },
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AI 推荐" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("推荐类型"), {
      target: { value: "variance_warning" },
    });
    fireEvent.change(screen.getByLabelText("状态"), {
      target: { value: "generated" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "资源类型" }), {
      target: { value: "bill_item" },
    });
    fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = new URL(String(input));
          return (
            url.pathname === "/v1/projects/project-001/ai/recommendations" &&
            url.searchParams.get("recommendationType") === "variance_warning" &&
            url.searchParams.get("status") === "generated" &&
            url.searchParams.get("resourceType") === "bill_item"
          );
        }),
      ).toBe(true);
    });
  });
});

function createWorkspace(
  permissionOverrides: Partial<{
    roleCode: string;
    roleLabel: string;
    canManageProject: boolean;
    canEditProject: boolean;
  }> = {},
) {
  return {
    project: {
      id: "project-001",
      code: "PRJ-001",
      name: "新点造价项目",
      status: "draft",
    },
    currentStage: {
      id: "stage-001",
      stageCode: "estimate",
      stageName: "概算",
      status: "active",
      sequenceNo: 1,
    },
    availableStages: [
      {
        id: "stage-001",
        stageCode: "estimate",
        stageName: "概算",
        status: "active",
        sequenceNo: 1,
      },
    ],
    disciplines: [
      {
        id: "discipline-001",
        disciplineCode: "building",
        disciplineName: "土建",
        status: "active",
      },
    ],
    billVersions: [],
    todoSummary: {
      totalCount: 0,
      pendingReviewCount: 0,
      pendingProcessDocumentCount: 0,
      draftProcessDocumentCount: 0,
      items: [],
    },
    riskSummary: {
      totalCount: 0,
      rejectedReviewCount: 0,
      rejectedProcessDocumentCount: 0,
      failedJobCount: 0,
      items: [],
    },
    importStatus: {
      mode: "import_task",
      totalCount: 0,
      queuedCount: 0,
      processingCount: 0,
      completedCount: 0,
      failedCount: 0,
      latestTask: null,
      note: "导入状态正常。",
    },
    currentUser: {
      userId: "user-001",
      displayName: "Owner User",
      memberId: "member-001",
      permissionSummary: {
        roleCode: "project_owner",
        roleLabel: "项目负责人",
        canManageProject: true,
        canEditProject: true,
        ...permissionOverrides,
        scopeSummary: ["项目全部范围"],
        visibleStageCodes: [],
        visibleDisciplineCodes: [],
      },
    },
  };
}

function createWorkspaceWithBillVersion(id: string, versionName: string) {
  return {
    ...createWorkspace(),
    billVersions: [
      {
        id,
        versionNo: 1,
        versionName,
        versionStatus: "editable",
        stageCode: "estimate",
        disciplineCode: "building",
      },
    ],
  };
}

function createRecommendation(
  overrides: Partial<{
    id: string;
    recommendationType: "bill_recommendation" | "quota_recommendation" | "variance_warning";
    status: "generated" | "accepted" | "ignored" | "expired" | "rolled_back";
    outputPayload: Record<string, unknown>;
    inputPayload: Record<string, unknown>;
    handledBy: string | null;
    handledAt: string | null;
    statusReason: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? "ai-recommendation-001",
    projectId: "project-001",
    stageCode: "estimate",
    disciplineCode: "building",
    resourceType: "bill_item",
    resourceId: "bill-item-001",
    recommendationType: overrides.recommendationType ?? "quota_recommendation",
    inputPayload: overrides.inputPayload ?? {},
    outputPayload: overrides.outputPayload ?? {
      quotaName: "挖土方",
      reason: "清单名称匹配",
    },
    status: overrides.status ?? "generated",
    createdBy: "engineer-001",
    handledBy: overrides.handledBy ?? null,
    handledAt: overrides.handledAt ?? null,
    statusReason: overrides.statusReason ?? null,
    createdAt: "2026-04-18T11:00:00.000Z",
    updatedAt: "2026-04-18T11:00:00.000Z",
  };
}

function createAiRecommendationJob(status: "queued" | "completed" | "failed") {
  return {
    id: "background-job-001",
    jobType: "ai_recommendation",
    status,
    requestedBy: "engineer-001",
    projectId: "project-001",
    payload: {},
    result: status === "completed" ? { createdCount: 1 } : null,
    errorMessage: status === "failed" ? "AI provider response is invalid" : null,
    createdAt: "2026-04-18T11:00:00.000Z",
    completedAt: status === "queued" ? null : "2026-04-18T11:01:00.000Z",
  };
}

function createRecommendationListResponse(items: unknown[]) {
  return {
    items,
    summary: {
      totalCount: items.length,
      statusCounts: {
        generated: 0,
        accepted: 0,
        ignored: 0,
        expired: 0,
      },
      typeCounts: {
        bill_recommendation: 0,
        quota_recommendation: 0,
        variance_warning: 0,
      },
    },
  };
}
