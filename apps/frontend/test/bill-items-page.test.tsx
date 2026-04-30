import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { BillItemsPage } from "../src/features/bills/bill-items-page";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function createJsonErrorResponse(body: unknown, status = 422) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

const priceVersions = [
  {
    id: "price-version-001",
    versionCode: "JS-BUILDING-2026",
    versionName: "江苏土建 2026",
    regionCode: "JS",
    disciplineCode: "building",
    status: "active",
  },
];

const feeTemplates = [
  {
    id: "fee-template-001",
    templateName: "估算取费模板",
    projectType: "building",
    regionCode: "JS",
    stageScope: ["estimate"],
    taxMode: "general",
    allocationMode: "by_discipline",
    status: "active",
  },
];

describe("BillItemsPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("filters bill items by code or name", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
              children: [
                {
                  id: "bill-item-002",
                  parentId: "bill-item-001",
                  code: "A.1",
                  name: "人工挖土方",
                  level: 2,
                  quantity: 12,
                  unit: "m3",
                },
              ],
            },
            {
              id: "bill-item-003",
              parentId: null,
              code: "B",
              name: "安装工程",
              level: 1,
              quantity: 1,
              unit: "项",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              versionNo: 2,
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
              sourceVersionId: "version-source-001",
              createdBy: "engineer-001",
              changeReason: "补充土建清单",
            },
            {
              id: "version-source-001",
              versionName: "招标清单 V1",
              versionNo: 1,
              stageCode: "tender",
              disciplineCode: "building",
              status: "locked",
              sourceVersionId: null,
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines/candidates") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/price-versions") {
        return createJsonResponse({ items: priceVersions });
      }

      if (url.pathname === "/v1/fee-templates") {
        return createJsonResponse({ items: feeTemplates });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "清单层级表格" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("筛选清单项"), {
      target: { value: "挖土" },
    });

    expect(screen.getByText("已筛选 1/3 项清单。")).toBeInTheDocument();
    expect(screen.getByText("人工挖土方")).toBeInTheDocument();
    expect(screen.queryByText("安装工程")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空筛选" }));

    expect(screen.getByText("安装工程")).toBeInTheDocument();
  });

  test("renders project name in breadcrumbs and header context", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              versionNo: 2,
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
              sourceVersionId: "version-source-001",
              createdBy: "engineer-001",
              changeReason: "补充土建清单",
            },
            {
              id: "version-source-001",
              versionName: "招标清单 V1",
              versionNo: 1,
              stageCode: "tender",
              disciplineCode: "building",
              status: "locked",
              sourceVersionId: null,
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines") {
        return createJsonResponse({
          items: [],
        });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines/candidates") {
        return createJsonResponse({
          items: [
            {
              sourceStandardSetCode: "js-2013-building",
              sourceQuotaId: "quota-source-001",
              sourceSequence: 1,
              chapterCode: "01",
              quotaCode: "010101001",
              quotaName: "人工挖土方",
              unit: "m3",
              laborFee: 120,
              materialFee: 50,
              machineFee: 30,
              sourceMode: "manual",
              sourceDataset: "js-2013-building",
              sourceRegion: "上海",
              workContentSummary: "挖土、装土、修边",
              resourceCompositionSummary: "人工费 120 / 材料费 50 / 机械费 30",
              matchReason: "关键字命中定额名称",
              matchScore: 0.9,
            },
          ],
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/quota-lines/validate" &&
        init?.method === "POST"
      ) {
        return createJsonResponse({
          passed: false,
          issueCount: 1,
          issues: [
            {
              code: "UNIT_MISMATCH",
              severity: "warning",
              message: "Quota line unit does not match bill item unit",
              billVersionId: "version-001",
              billItemId: "bill-item-001",
              billItemCode: "A",
              billItemName: "土建工程",
              quotaLineId: "quota-line-001",
              quotaCode: "010101001",
              billItemUnit: "m3",
              quotaUnit: "m2",
            },
          ],
        });
      }

      if (url.pathname === "/v1/price-versions") {
        return createJsonResponse({ items: priceVersions });
      }

      if (url.pathname === "/v1/fee-templates") {
        return createJsonResponse({ items: feeTemplates });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "清单页" })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "新点造价项目" })).toHaveAttribute(
      "href",
      "/projects/project-001",
    );
    expect(screen.getByText("当前项目：新点造价项目（XM-001）")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "计价配置" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "版本与来源" })).toBeInTheDocument();
    expect(screen.getByText("当前阶段：estimate")).toBeInTheDocument();
    expect(screen.getByText("当前版本：估算版 V1（V2）")).toBeInTheDocument();
    expect(screen.getByText("来源版本：招标清单 V1")).toBeInTheDocument();
    expect(screen.getByText("锁定状态：editable")).toBeInTheDocument();
    expect(screen.getByText("创建人：engineer-001")).toBeInTheDocument();
    expect(screen.getByText("变更原因：补充土建清单")).toBeInTheDocument();
    expect(screen.getByText("江苏土建 2026（JS / building）")).toBeInTheDocument();
    expect(screen.getByText("估算取费模板（estimate）")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "定额选择器" })).toBeInTheDocument();
    expect(screen.getByText("人工挖土方")).toBeInTheDocument();
    expect(screen.getByText("上海 / js-2013-building")).toBeInTheDocument();
    expect(screen.getByText("关键字命中定额名称")).toBeInTheDocument();
    expect(screen.getByText("人工费 120 / 材料费 50 / 机械费 30")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "校验定额" }));

    await waitFor(() => {
      expect(screen.getByText("定额校验发现 1 个问题。")).toBeInTheDocument();
    });
    expect(screen.getByText("UNIT_MISMATCH")).toBeInTheDocument();
    expect(screen.getByText("m3 / m2")).toBeInTheDocument();
  });

  test("adds selected quota candidates to the current bill item", async () => {
    let quotaLines = [
      {
        id: "quota-line-001",
        billItemId: "bill-item-001",
        billVersionId: "version-001",
        stageCode: "estimate",
        disciplineCode: "building",
        billItemCode: "A",
        billItemName: "土建工程",
        sourceStandardSetCode: "js-2013-building",
        sourceQuotaId: "quota-source-000",
        chapterCode: "00",
        quotaCode: "000001",
        quotaName: "既有定额",
        unit: "项",
        quantity: 1,
        contentFactor: 1,
        sourceMode: "manual",
        laborFee: 12,
        materialFee: 8,
        machineFee: 6,
      },
    ];
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/quota-lines/batch-create" &&
        init?.method === "POST"
      ) {
        quotaLines = [
          ...quotaLines,
          {
            id: "quota-line-002",
            billItemId: "bill-item-001",
            billVersionId: "version-001",
            stageCode: "estimate",
            disciplineCode: "building",
            billItemCode: "A",
            billItemName: "土建工程",
            sourceStandardSetCode: "js-2013-building",
            sourceQuotaId: "quota-source-001",
            chapterCode: "01",
            quotaCode: "010101001",
            quotaName: "人工挖土方",
            unit: "m3",
            quantity: 1,
            contentFactor: 1,
            sourceMode: "manual",
            laborFee: 120,
            materialFee: 50,
            machineFee: 30,
          },
        ];
        return createJsonResponse({ items: [quotaLines[1]] });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines") {
        return createJsonResponse({
          items: quotaLines,
        });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines/candidates") {
        return createJsonResponse({
          items: [
            {
              sourceStandardSetCode: "js-2013-building",
              sourceQuotaId: "quota-source-001",
              sourceSequence: 1,
              chapterCode: "01",
              quotaCode: "010101001",
              quotaName: "人工挖土方",
              unit: "m3",
              laborFee: 120,
              materialFee: 50,
              machineFee: 30,
              sourceMode: "manual",
            },
          ],
        });
      }

      if (url.pathname === "/v1/price-versions") {
        return createJsonResponse({ items: priceVersions });
      }

      if (url.pathname === "/v1/fee-templates") {
        return createJsonResponse({ items: feeTemplates });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "定额选择器" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择 010101001"));
    fireEvent.click(screen.getByRole("button", { name: "批量添加" }));

    await waitFor(() => {
      expect(screen.getByText("已添加 1 条定额。")).toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        const url = new URL(String(input));
        return (
          url.pathname === "/v1/projects/project-001/quota-lines/batch-create" &&
          init?.method === "POST"
        );
      }),
    ).toBe(true);
    expect(screen.getByText("既有定额")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("manual").length).toBeGreaterThan(0);
  });

  test("filters quota candidates before batch add", async () => {
    let batchCreateBody: { items: Array<Record<string, unknown>> } | null = null;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/quota-lines/batch-create" &&
        init?.method === "POST"
      ) {
        batchCreateBody = JSON.parse(String(init.body));
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines/candidates") {
        return createJsonResponse({
          items: [
            {
              sourceStandardSetCode: "js-2013-building",
              sourceQuotaId: "quota-source-001",
              sourceSequence: 1,
              chapterCode: "01",
              quotaCode: "010101001",
              quotaName: "人工挖土方",
              unit: "m3",
              laborFee: 120,
              materialFee: 50,
              machineFee: 30,
              sourceMode: "manual",
              matchReason: "土方关键字命中",
            },
            {
              sourceStandardSetCode: "js-2013-building",
              sourceQuotaId: "quota-source-002",
              sourceSequence: 2,
              chapterCode: "02",
              quotaCode: "020101001",
              quotaName: "混凝土垫层",
              unit: "m2",
              laborFee: 80,
              materialFee: 160,
              machineFee: 20,
              sourceMode: "manual",
              matchReason: "垫层关键字命中",
            },
          ],
        });
      }

      if (url.pathname === "/v1/price-versions") {
        return createJsonResponse({ items: priceVersions });
      }

      if (url.pathname === "/v1/fee-templates") {
        return createJsonResponse({ items: feeTemplates });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "定额选择器" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("筛选候选定额"), {
      target: { value: "垫层" },
    });

    expect(screen.getByText("已筛选 1/2 条候选定额。")).toBeInTheDocument();
    expect(screen.getByText("混凝土垫层")).toBeInTheDocument();
    expect(screen.queryByText("人工挖土方")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("选择 020101001"));
    fireEvent.click(screen.getByRole("button", { name: "批量添加" }));

    await waitFor(() => {
      expect(screen.getByText("已添加 1 条定额。")).toBeInTheDocument();
    });
    expect(batchCreateBody).not.toBeNull();
    expect(batchCreateBody!.items).toMatchObject([
      {
        sourceQuotaId: "quota-source-002",
        quotaName: "混凝土垫层",
      },
    ]);
  });

  test("filters pricing configuration options and shows empty states", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines/candidates") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/price-versions") {
        return createJsonResponse({
          items: [
            ...priceVersions,
            {
              id: "price-version-002",
              versionCode: "ZJ-INSTALL-2026",
              versionName: "浙江安装 2026",
              regionCode: "ZJ",
              disciplineCode: "installation",
              status: "active",
            },
          ],
        });
      }

      if (url.pathname === "/v1/fee-templates") {
        return createJsonResponse({ items: [] });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "计价配置" })).toBeInTheDocument();
    });

    expect(screen.getByText("暂无可用取费模板")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "单项计价" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("筛选价目版本"), {
      target: { value: "浙江" },
    });

    expect(screen.getByText("已筛选 1/2 个价目版本。")).toBeInTheDocument();
    expect(screen.getByText("浙江安装 2026（ZJ / installation）")).toBeInTheDocument();
    expect(screen.queryByText("江苏土建 2026（JS / building）")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("筛选价目版本"), {
      target: { value: "广东" },
    });

    expect(screen.getByText("没有匹配价目版本")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "清空价目筛选" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "清空价目筛选" }));

    expect(screen.getByText("江苏土建 2026（JS / building）")).toBeInTheDocument();
  });

  test("explains disabled pricing actions while allowing cleared defaults to be saved", async () => {
    const defaultUpdates: unknown[] = [];

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: "price-version-001",
          defaultFeeTemplateId: "fee-template-001",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines/candidates") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/price-versions") {
        return createJsonResponse({ items: priceVersions });
      }

      if (url.pathname === "/v1/fee-templates") {
        return createJsonResponse({ items: feeTemplates });
      }

      if (
        url.pathname === "/v1/projects/project-001/default-price-version" &&
        init?.method === "PUT"
      ) {
        defaultUpdates.push(JSON.parse(String(init.body)));
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: null,
          defaultFeeTemplateId: "fee-template-001",
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/default-fee-template" &&
        init?.method === "PUT"
      ) {
        defaultUpdates.push(JSON.parse(String(init.body)));
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: null,
          defaultFeeTemplateId: null,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "计价配置" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("默认价目版本"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("默认取费模板"), {
      target: { value: "" },
    });

    const disabledReason = "计价类动作不可用：请先绑定默认价目版本和默认取费模板。";
    expect(screen.getByText(disabledReason)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "单项计价" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "单项计价" })).toHaveAttribute(
      "title",
      disabledReason,
    );
    expect(screen.getByRole("button", { name: "重算当前版本" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "创建项目重算" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => {
      expect(screen.getByText("计价配置已保存。")).toBeInTheDocument();
    });
    expect(defaultUpdates).toEqual([
      { defaultPriceVersionId: null },
      { defaultFeeTemplateId: null },
    ]);
  });

  test("updates pricing defaults and recalculates the current bill version", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: "price-version-001",
          defaultFeeTemplateId: "fee-template-001",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
              systemAmount: 1000,
              finalAmount: 1000,
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines/candidates") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/price-versions") {
        return createJsonResponse({ items: priceVersions });
      }

      if (url.pathname === "/v1/fee-templates") {
        return createJsonResponse({ items: feeTemplates });
      }

      if (
        url.pathname === "/v1/projects/project-001/default-price-version" &&
        init?.method === "PUT"
      ) {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: "price-version-001",
          defaultFeeTemplateId: "fee-template-001",
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/default-fee-template" &&
        init?.method === "PUT"
      ) {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: "price-version-001",
          defaultFeeTemplateId: "fee-template-001",
        });
      }

      if (
        url.pathname ===
          "/v1/projects/project-001/bill-versions/version-001/recalculate" &&
        init?.method === "POST"
      ) {
        return createJsonResponse({
          recalculatedCount: 1,
          skippedItems: [],
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/recalculate" &&
        init?.method === "POST"
      ) {
        return createJsonResponse({
          id: "job-recalculate-001",
          jobType: "project_recalculate",
          status: "queued",
          requestedBy: "engineer-001",
          projectId: "project-001",
          payload: {},
          createdAt: "2026-04-27T00:00:00.000Z",
        });
      }

      if (url.pathname === "/v1/engine/calculate" && init?.method === "POST") {
        return createJsonResponse({
          billItemId: "bill-item-001",
          systemUnitPrice: 10,
          finalUnitPrice: 10,
          systemAmount: 1000,
          finalAmount: 1000,
        });
      }

      if (
        url.pathname ===
          "/v1/projects/project-001/bill-versions/version-001/items/bill-item-001/manual-pricing" &&
        init?.method === "PUT"
      ) {
        return createJsonResponse({
          id: "bill-item-001",
          parentId: null,
          code: "A",
          name: "土建工程",
          level: 1,
          quantity: 1,
          unit: "项",
          systemUnitPrice: 10,
          manualUnitPrice: 12.5,
          finalUnitPrice: 12.5,
          systemAmount: 1000,
          finalAmount: 1250,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "计价配置" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => {
      expect(screen.getByText("计价配置已保存。")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "重算当前版本" }));

    await waitFor(() => {
      expect(
        screen.getByText("重算完成：已更新 1 条清单项，跳过 0 条。"),
      ).toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        const url = new URL(String(input));
        return (
          url.pathname ===
            "/v1/projects/project-001/bill-versions/version-001/recalculate" &&
          init?.method === "POST"
        );
      }),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "创建项目重算" }));

    await waitFor(() => {
      expect(
        screen.getByText("项目重算任务已创建：job-recalculate-001（queued）。可前往任务页查看状态。"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "单项计价" }));

    await waitFor(() => {
      expect(screen.getByText("当前清单项计价完成。")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("人工综合单价"), {
      target: { value: "12.5" },
    });
    fireEvent.change(screen.getByLabelText("调价原因"), {
      target: { value: "市场询价调整" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存人工价" }));

    await waitFor(() => {
      expect(screen.getByText("人工调价已保存。")).toBeInTheDocument();
    });
    expect(
      fetchMock.mock.calls.some(([input, init]) => {
        const url = new URL(String(input));
        return (
          url.pathname ===
            "/v1/projects/project-001/bill-versions/version-001/items/bill-item-001/manual-pricing" &&
          init?.method === "PUT"
        );
      }),
    ).toBe(true);
  });

  test("shows action-specific pricing API error guidance", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: "price-version-001",
          defaultFeeTemplateId: "fee-template-001",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines/candidates") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/price-versions") {
        return createJsonResponse({ items: priceVersions });
      }

      if (url.pathname === "/v1/fee-templates") {
        return createJsonResponse({ items: feeTemplates });
      }

      if (url.pathname === "/v1/engine/calculate" && init?.method === "POST") {
        return createJsonErrorResponse({
          error: {
            code: "VALIDATION_ERROR",
            message: "Some quota lines could not be matched to the selected price version",
            details: [
              {
                quotaCode: "010101002",
                quotaLineId: "quota-line-002",
              },
            ],
          },
        });
      }

      if (
        url.pathname ===
          "/v1/projects/project-001/bill-versions/version-001/recalculate" &&
        init?.method === "POST"
      ) {
        return createJsonErrorResponse({
          error: {
            code: "VALIDATION_ERROR",
            message: "Price version discipline does not match the requested recalculation scope",
          },
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/recalculate" &&
        init?.method === "POST"
      ) {
        return createJsonErrorResponse({
          error: {
            code: "VALIDATION_ERROR",
            message: "Fee template does not apply to the requested recalculation scope",
          },
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "计价配置" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "单项计价" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "单项计价失败：价目明细未命中，定额 010101002 在所选价目版本中没有价格。原始错误：Some quota lines could not be matched to the selected price version",
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "重算当前版本" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "当前版本重算失败：所选价目版本专业与当前重算范围不匹配。原始错误：Price version discipline does not match the requested recalculation scope",
        ),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "创建项目重算" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "项目重算任务创建失败：所选取费模板不适用于当前阶段或重算范围。原始错误：Fee template does not apply to the requested recalculation scope",
        ),
      ).toBeInTheDocument();
    });
  });

  test("shows pricing binding status, clears stale skipped details, and links scoped project jobs", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001") {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: "price-version-001",
          defaultFeeTemplateId: "fee-template-001",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/items") {
        return createJsonResponse({
          items: [
            {
              id: "bill-item-001",
              parentId: null,
              code: "A",
              name: "土建工程",
              level: 1,
              quantity: 1,
              unit: "项",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions") {
        return createJsonResponse({
          items: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "editable",
            },
          ],
        });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/quota-lines/candidates") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/price-versions") {
        return createJsonResponse({
          items: [
            ...priceVersions,
            {
              id: "price-version-002",
              versionCode: "JS-BUILDING-2027",
              versionName: "江苏土建 2027",
              regionCode: "JS",
              disciplineCode: "building",
              status: "active",
            },
          ],
        });
      }

      if (url.pathname === "/v1/fee-templates") {
        return createJsonResponse({ items: feeTemplates });
      }

      if (
        url.pathname ===
          "/v1/projects/project-001/bill-versions/version-001/recalculate" &&
        init?.method === "POST"
      ) {
        return createJsonResponse({
          recalculatedCount: 1,
          skippedItems: [
            {
              billItemId: "bill-item-missing",
              reason: "missing_quota_lines",
              label: "缺少定额明细",
              details: {
                quotaLineCount: 0,
              },
            },
            {
              billItemId: "bill-item-invalid",
              reason: "invalid_quantity",
              label: "工程量不合法",
              details: {
                quantity: 0,
              },
            },
            {
              billItemId: "bill-item-unmatched",
              reason: "unmatched_price_items",
              label: "价目匹配失败",
              details: {
                unmatchedQuotaCodes: ["010101002", "010101003"],
              },
            },
          ],
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/recalculate" &&
        init?.method === "POST"
      ) {
        return createJsonResponse({
          id: "job-recalculate-001",
          jobType: "project_recalculate",
          status: "queued",
          requestedBy: "engineer-001",
          projectId: "project-001",
          payload: {},
          createdAt: "2026-04-27T00:00:00.000Z",
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/default-price-version" &&
        init?.method === "PUT"
      ) {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: "price-version-001",
          defaultFeeTemplateId: "fee-template-001",
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/default-fee-template" &&
        init?.method === "PUT"
      ) {
        return createJsonResponse({
          id: "project-001",
          code: "XM-001",
          name: "新点造价项目",
          status: "active",
          defaultPriceVersionId: "price-version-001",
          defaultFeeTemplateId: "fee-template-001",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001/bill-versions/version-001/items"]}>
        <Routes>
          <Route
            path="/projects/:projectId/bill-versions/:versionId/items"
            element={<BillItemsPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "计价配置" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => {
      expect(screen.getByText("当前已绑定价目版本：江苏土建 2026")).toBeInTheDocument();
    });
    expect(screen.getByText("当前已绑定取费模板：估算取费模板")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "重算当前版本" }));

    await waitFor(() => {
      expect(
        screen.getByText("重算完成：已更新 1 条清单项，跳过 3 条。"),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "重算跳过明细" })).toBeInTheDocument();
    expect(screen.getByText("bill-item-missing")).toBeInTheDocument();
    expect(screen.getByText("缺少定额明细")).toBeInTheDocument();
    expect(screen.getByText("定额明细 0 条")).toBeInTheDocument();
    expect(screen.getByText("bill-item-invalid")).toBeInTheDocument();
    expect(screen.getByText("工程量不合法")).toBeInTheDocument();
    expect(screen.getByText("工程量 0")).toBeInTheDocument();
    expect(screen.getByText("bill-item-unmatched")).toBeInTheDocument();
    expect(screen.getByText("价目匹配失败")).toBeInTheDocument();
    expect(screen.getByText("未命中定额 010101002、010101003")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("默认价目版本"), {
      target: { value: "price-version-002" },
    });

    expect(screen.queryByRole("heading", { name: "重算跳过明细" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("筛选价目版本"), {
      target: { value: "不存在的价目" },
    });

    expect(screen.getByText("没有匹配价目版本")).toBeInTheDocument();
    expect(
      screen.getByText("当前选择：江苏土建 2027。可清空筛选或改用未绑定后保存。"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "创建项目重算" }));

    await waitFor(() => {
      expect(
        screen.getByText("项目重算任务已创建：job-recalculate-001（queued）。可前往任务页查看状态。"),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "查看项目重算任务" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?jobType=project_recalculate&stageCode=estimate&disciplineCode=building",
    );
  });
});
