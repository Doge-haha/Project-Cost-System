import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ProjectDetailPage } from "../src/features/projects/project-detail-page";
import { saveRecentProcessingLink } from "../src/features/projects/recent-processing-link";

function createJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function createSourceBillWorkbookFile() {
  const entries = new Map<string, string>();
  entries.set(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
  );
  entries.set(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );
  entries.set(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
</Relationships>`,
  );
  entries.set(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="QdList" sheetId="1" r:id="rId1"/>
    <sheet name="Qdxm" sheetId="2" r:id="rId2"/>
    <sheet name="Gznr" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>`,
  );
  entries.set(
    "xl/worksheets/sheet1.xml",
    worksheetXml([
      ["QdID", "Qdmc", "QdGf"],
      ["list-001", "招标清单", "GB50500-2013"],
    ]),
  );
  entries.set(
    "xl/worksheets/sheet2.xml",
    worksheetXml([
      ["QdID", "Qdbh", "Xmmc", "Dw", "Gcl"],
      ["item-001", "010101001001", "平整场地", "m2", "120"],
    ]),
  );
  entries.set(
    "xl/worksheets/sheet3.xml",
    worksheetXml([
      ["QdID", "Gznr"],
      ["item-001", "清理、平整"],
    ]),
  );

  return new File([zipStored(entries)], "source-bill.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function createLegacySourceBillWorkbookFile() {
  return new File(
    [
      new Uint8Array([
        0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00, 0x00, 0x00,
      ]),
    ],
    "legacy-source-bill.xls",
    { type: "application/vnd.ms-excel" },
  );
}

function worksheetXml(rows: string[][]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rows
      .map(
        (row, rowIndex) =>
          `<row r="${rowIndex + 1}">${row
            .map(
              (cell, cellIndex) =>
                `<c r="${columnName(cellIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(
                  cell,
                )}</t></is></c>`,
            )
            .join("")}</row>`,
      )
      .join("")}
  </sheetData>
</worksheet>`;
}

function columnName(index: number) {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function zipStored(entries: Map<string, string>) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(content);
    const crc = crc32(contentBytes);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 8, 0);
    writeUint32(localHeader, 14, crc);
    writeUint32(localHeader, 18, contentBytes.length);
    writeUint32(localHeader, 22, contentBytes.length);
    writeUint16(localHeader, 26, nameBytes.length);
    localHeader.set(nameBytes, 30);
    chunks.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint32(centralHeader, 16, crc);
    writeUint32(centralHeader, 20, contentBytes.length);
    writeUint32(centralHeader, 24, contentBytes.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralDirectory.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  }

  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 8, entries.size);
  writeUint16(end, 10, entries.size);
  writeUint32(end, 12, centralSize);
  writeUint32(end, 16, offset);
  const size = chunks
    .concat(centralDirectory, end)
    .reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks.concat(centralDirectory, end)) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output.buffer.slice(0);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  writeUint16(bytes, offset, value & 0xffff);
  writeUint16(bytes, offset + 2, value >>> 16);
}

describe("ProjectDetailPage", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const clipboardWriteText = vi.fn<(value: string) => Promise<void>>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
    vi.stubGlobal(
      "location",
      new URL("http://localhost/projects/project-001?refresh=jobs"),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    clipboardWriteText.mockReset();
    window.sessionStorage.clear();
  });

  test("renders workspace aggregation and current user permission summary", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/reviews?filter=pending&summaryFocus=pending",
      label: "审核待处理入口",
      collaborationUnitLabel: "缺少必填字段 · 资源 bill_item · 动作 create",
      sourceLabel: "审核处理页",
    });

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: {
            id: "stage-001",
            stageCode: "estimate",
            stageName: "投资估算",
            status: "active",
            sequenceNo: 1,
          },
          availableStages: [
            {
              id: "stage-001",
              stageCode: "estimate",
              stageName: "投资估算",
              status: "active",
              sequenceNo: 1,
            },
            {
              id: "stage-002",
              stageCode: "budget",
              stageName: "施工图预算",
              status: "draft",
              sequenceNo: 2,
            },
          ],
          disciplines: [
            {
              id: "discipline-001",
              disciplineCode: "building",
              disciplineName: "建筑工程",
              status: "enabled",
            },
          ],
          billVersions: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              versionStatus: "editable",
            },
          ],
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: ["estimate", "budget"],
              visibleDisciplineCodes: ["building"],
            },
          },
          todoSummary: {
            totalCount: 3,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 1,
            draftProcessDocumentCount: 1,
            items: ["1 条审核待处理", "1 条过程单据待审核", "1 条过程单据仍在草稿"],
          },
          riskSummary: {
            totalCount: 2,
            rejectedReviewCount: 1,
            rejectedProcessDocumentCount: 1,
            failedJobCount: 0,
            items: ["1 条审核被驳回", "1 条过程单据被退回"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 2,
            queuedCount: 1,
            processingCount: 1,
            completedCount: 0,
            failedCount: 0,
            latestTask: {
              id: "import-task-001",
              sourceType: "audit_log",
              sourceLabel: "审计日志筛选导入",
              status: "processing",
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
        });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 1000,
          totalFinalAmount: 1180,
          varianceAmount: 180,
          itemCount: 5,
          billVersionCount: 1,
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({
          items: [
            {
              id: "audit-log-003",
              projectId: "project-001",
              stageCode: "estimate",
              resourceType: "background_job",
              resourceId: "job-001",
              action: "retried",
              operatorId: "user-001",
              beforePayload: {
                status: "failed",
              },
              afterPayload: {
                status: "queued",
              },
              createdAt: "2026-04-18T13:10:00.000Z",
            },
            {
              id: "audit-log-002",
              projectId: "project-001",
              stageCode: "estimate",
              resourceType: "process_document",
              resourceId: "doc-001",
              action: "approve",
              operatorId: "user-001",
              beforePayload: {
                status: "submitted",
              },
              afterPayload: {
                status: "approved",
              },
              createdAt: "2026-04-18T13:05:00.000Z",
            },
            {
              id: "audit-log-001",
              projectId: "project-001",
              stageCode: "estimate",
              resourceType: "review_submission",
              resourceId: "review-001",
              action: "reject",
              operatorId: "user-001",
              beforePayload: {
                status: "pending",
              },
              afterPayload: {
                status: "rejected",
              },
              createdAt: "2026-04-18T13:00:00.000Z",
            },
          ],
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/bill-imports/source/preview" &&
        init?.method === "POST"
      ) {
        const payload = JSON.parse(String(init.body ?? "{}")) as {
          sourceFileName?: string;
          sourceTables: {
            ZaoJia_Qd_QdList: unknown[];
            ZaoJia_Qd_Qdxm: unknown[];
            ZaoJia_Qd_Gznr: unknown[];
          };
        };
        expect(payload.sourceFileName).toBe("source-bill.csv");
        expect(payload.sourceTables.ZaoJia_Qd_Qdxm).toHaveLength(2);

        return createJsonResponse({
          summary: {
            versionCount: 1,
            billItemCount: 2,
            workItemCount: 0,
            failedItemCount: 1,
            measureItemCount: 1,
            feeItemCount: 1,
            featureItemCount: 1,
            quotaClueCount: 1,
            failureDetails: ["ZaoJia_Qd_Qdxm[1] 重复编码 010101001001，已按源行保留"],
          },
          failedItems: [
            {
              lineNo: 2,
              tableName: "ZaoJia_Qd_Qdxm",
              sourceId: "item-002",
              itemCode: "010101001001",
              reasonCode: "duplicate_code",
              reasonLabel: "重复编码",
              errorMessage: "重复编码 010101001001，已按源行保留",
              projectId: null,
              resourceType: "bill_item",
              action: "create",
              keys: ["Qdbh"],
            },
          ],
        });
      }

      if (
        url.pathname === "/v1/projects/project-001/bill-imports/source" &&
        init?.method === "POST"
      ) {
        const payload = JSON.parse(String(init.body ?? "{}")) as {
          sourceFileName?: string;
          sourceTables: {
            ZaoJia_Qd_QdList: unknown[];
            ZaoJia_Qd_Qdxm: unknown[];
            ZaoJia_Qd_Gznr: unknown[];
          };
        };
        expect(payload.sourceFileName).toBe("source-bill.csv");
        expect(payload.sourceTables.ZaoJia_Qd_QdList).toHaveLength(0);
        expect(payload.sourceTables.ZaoJia_Qd_Qdxm).toHaveLength(2);
        expect(payload.sourceTables.ZaoJia_Qd_Gznr).toHaveLength(0);

        return createJsonResponse({
          billVersion: {
            id: "version-import-001",
            versionName: "源清单导入版",
            stageCode: "estimate",
            disciplineCode: "building",
            versionStatus: "editable",
          },
          importTask: {
            id: "import-task-source-001",
            status: "failed",
          },
          summary: {
            versionCount: 1,
            billItemCount: 1,
            workItemCount: 0,
            failedItemCount: 1,
            measureItemCount: 1,
            feeItemCount: 1,
            featureItemCount: 1,
            quotaClueCount: 1,
            failureDetails: ["ZaoJia_Qd_Qdxm[1] 重复编码 010101001001，已按源行保留"],
          },
          failedItems: [
            {
              lineNo: 2,
              tableName: "ZaoJia_Qd_Qdxm",
              sourceId: "item-002",
              itemCode: "010101001001",
              reasonCode: "duplicate_code",
              reasonLabel: "重复编码",
              errorMessage: "重复编码 010101001001，已按源行保留",
              projectId: null,
              resourceType: "bill_item",
              action: "create",
              keys: ["Qdbh"],
            },
          ],
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001?refresh=jobs&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId"
            element={
              <>
                <ProjectDetailPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "新点造价项目" })).toBeInTheDocument();
    });

    expect(screen.getByText("当前用户权限")).toBeInTheDocument();
    expect(screen.getByText("Owner User · project_owner")).toBeInTheDocument();
    expect(screen.getByText("角色：项目负责人")).toBeInTheDocument();
    expect(screen.getByText("项目全部范围")).toBeInTheDocument();
    expect(screen.getByText("投资估算 · estimate · active")).toBeInTheDocument();
    expect(screen.getByText("建筑工程 · building")).toBeInTheDocument();
    expect(screen.getByText("估算版 V1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /进入清单页/ })).toBeInTheDocument();
    expect(screen.getByText("待办摘要")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1 条审核待处理" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?filter=pending&summaryFocus=pending",
    );
    expect(screen.getByRole("link", { name: "1 条过程单据仍在草稿" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?filter=draft&summaryFocus=draft",
    );
    expect(screen.getByRole("link", { name: "打开待办页" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=todo",
    );
    expect(screen.getByText("风险摘要")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1 条过程单据被退回" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?filter=rejected&summaryFocus=rejected",
    );
    expect(screen.getByRole("link", { name: "打开风险跟进" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=risk",
    );
    expect(screen.getByText("最近协作动作：审核处理页复制了审核待处理入口")).toBeInTheDocument();
    expect(
      screen.getAllByText("当前协作处理单元：缺少必填字段 · 资源 bill_item · 动作 create").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "回到审核处理页（待处理）" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?filter=pending&summaryFocus=pending",
    );
    expect(screen.getByRole("link", { name: "回到审核处理页（待处理）" })).toHaveClass(
      "recent-processing-action-link-primary",
    );
    expect(screen.queryByRole("link", { name: "打开最近协作入口" })).not.toBeInTheDocument();
    expect(screen.getByText("导入状态")).toBeInTheDocument();
    expect(screen.getByLabelText("选择源清单文件")).toBeInTheDocument();
    expect(screen.getByText("当前协作视角：缺少必填字段")).toBeInTheDocument();
    expect(
      screen.getAllByText("当前协作处理单元：缺少必填字段 · 资源 bill_item · 动作 create").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("最近导入：审计日志筛选导入 · processing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开任务状态" })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
    expect(screen.getByRole("link", { name: "打开导入跟进" })).toHaveAttribute(
      "href",
      "/projects/project-001/inbox?focus=import&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
    const sourceBillFile = new File(
      [
        [
          "QdID,Qdbh,Xmmc,Dw,Gcl,measureFlag,feeId,featureText,quotaCode",
          "item-001,010101001001,平整场地,m2,1,,,,",
          "item-002,010101001001,重复编码行,m2,,是,fee-001,三类土,1-1",
        ].join("\n"),
      ],
      "source-bill.csv",
      { type: "text/csv" },
    );
    fireEvent.change(screen.getByLabelText("选择源清单文件"), {
      target: { files: [sourceBillFile] },
    });
    expect(await screen.findByText("已选择 source-bill.csv，请先预览确认。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "预览导入" }));
    expect(await screen.findByText("源清单导入预览")).toBeInTheDocument();
    expect(screen.getByText(/版本 1 · 清单项 2 · 工作内容 0 · 失败 1/)).toBeInTheDocument();
    expect(screen.getByText(/措施项 1 · 费用项 1 · 清单特征 1 · 定额线索 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重复编码 · 1" })).toBeInTheDocument();
    const repairTemplateLink = screen.getByRole("link", { name: "下载修复模板" });
    expect(repairTemplateLink).toHaveAttribute(
      "download",
      "source-bill-fix-template.csv",
    );
    expect(decodeURIComponent(repairTemplateLink.getAttribute("href") ?? "")).toContain(
      "tableName,lineNo,reasonCode,reasonLabel,sourceId,itemCode,errorMessage,Qdbh",
    );
    expect(decodeURIComponent(repairTemplateLink.getAttribute("href") ?? "")).toContain(
      "ZaoJia_Qd_Qdxm,2,duplicate_code,重复编码,item-002,010101001001",
    );
    fireEvent.click(screen.getByRole("button", { name: "确认导入" }));
    expect(await screen.findByText("导入失败：清单项 1，工作内容 0，失败 1")).toBeInTheDocument();
    expect(
      screen.getByText("ZaoJia_Qd_Qdxm[1] 重复编码 010101001001，已按源行保留"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制当前协作链接" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001?refresh=jobs&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
      );
    });
    expect(
      await screen.findByText("已复制当前协作链接，可直接发给协作同事。"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "打开刚复制入口" }).at(-1)).toHaveAttribute(
      "href",
      "/projects/project-001?refresh=jobs&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
    expect(screen.getByText("最近动态")).toBeInTheDocument();
    expect(screen.getByText("异步任务 · 已重试")).toBeInTheDocument();
    expect(screen.getByText("过程单据 · 已通过")).toBeInTheDocument();
    expect(screen.getByText("审核 · 已驳回")).toBeInTheDocument();
    expect(screen.getByText("任务状态已更新，工作台摘要和最近动态已刷新。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /审核 · 已驳回/ })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-001&action=reject",
    );
    expect(screen.getByRole("link", { name: /过程单据 · 已通过/ })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-001&action=approve",
    );
    expect(screen.getByRole("link", { name: /异步任务 · 已重试/ })).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?jobId=job-001&status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
    fireEvent.click(screen.getByRole("button", { name: "复制异步任务处理链接" }));
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith(
        "http://localhost/projects/project-001/jobs?jobId=job-001&status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
      );
    });
    expect(screen.getByText("已复制异步任务处理链接，可直接发给协作同事。")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "打开刚复制入口" }).at(-1)).toHaveAttribute(
      "href",
      "/projects/project-001/jobs?jobId=job-001&status=failed&failureReason=missing_field&failureResourceType=bill_item&failureAction=create",
    );
    fireEvent.click(screen.getByRole("button", { name: "清除协作视角" }));
    expect(screen.getAllByTestId("location-search").at(-1)).toHaveTextContent("?refresh=jobs");
    expect(screen.queryByText("当前协作视角：缺少必填字段")).not.toBeInTheDocument();
    expect(screen.queryByText("已复制当前协作链接，可直接发给协作同事。")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "清除最近协作记录" }));
    expect(screen.queryByText("最近协作动作：审核处理页复制了审核待处理入口")).not.toBeInTheDocument();
  });

  test("shows detailed refresh notice for review and process document results", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
          todoSummary: {
            totalCount: 1,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 0,
            items: ["1 条审核待处理"],
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
            note: "note",
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({
          items: [
            {
              id: "audit-log-001",
              projectId: "project-001",
              stageCode: "estimate",
              resourceType: "review_submission",
              resourceId: "review-001",
              action: "reject",
              operatorId: "user-001",
              beforePayload: { status: "pending" },
              afterPayload: { status: "rejected" },
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            {
              id: "audit-log-002",
              projectId: "project-001",
              stageCode: "estimate",
              resourceType: "process_document",
              resourceId: "doc-001",
              action: "approve",
              operatorId: "user-001",
              beforePayload: { status: "submitted" },
              afterPayload: { status: "approved" },
              createdAt: "2026-04-18T13:05:00.000Z",
            },
          ],
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    const firstRender = render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001?refresh=reviews&resultStatus=approved&resultName=%E4%BC%B0%E7%AE%97%E7%89%88+V1&resultKind=review&resultId=review-001",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("估算版 V1 已通过，工作台摘要和最近动态已刷新。"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("共 0 项待办")).toBeInTheDocument();
    expect(screen.queryByText("1 条审核待处理")).not.toBeInTheDocument();
    expect(screen.getByText("最近动态").closest(".panel")).toHaveClass("panel-focus");
    expect(screen.getByText("审核 · 已驳回").closest(".activity-item")).toHaveClass("selected");
    fireEvent.click(screen.getByRole("button", { name: "收起提示" }));
    await waitFor(() => {
      expect(
        screen.queryByText("估算版 V1 已通过，工作台摘要和最近动态已刷新。"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByText("最近动态").closest(".panel")).not.toHaveClass("panel-focus");

    firstRender.unmount();

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001?refresh=process-documents&resultStatus=approved&resultName=%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95&resultKind=process-document&resultId=doc-001",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("设计变更单 已通过，工作台摘要和最近动态已刷新。"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("共 0 项风险")).toBeInTheDocument();
    expect(screen.queryByText("1 条过程单据被退回")).not.toBeInTheDocument();
    expect(screen.getByText("过程单据 · 已通过").closest(".activity-item")).toHaveClass("selected");
    fireEvent.click(screen.getByRole("button", { name: "收起提示" }));
    await waitFor(() => {
      expect(
        screen.queryByText("设计变更单 已通过，工作台摘要和最近动态已刷新。"),
      ).not.toBeInTheDocument();
    });
  });

  test("shows a semantic return action for process document source in recent collaboration summary", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/process-documents?filter=submitted&summaryFocus=submitted",
      label: "过程单据待审核入口",
      sourceLabel: "过程单据页",
    });

    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: {
            id: "stage-001",
            stageCode: "estimate",
            stageName: "投资估算",
            status: "active",
            sequenceNo: 1,
          },
          availableStages: [
            {
              id: "stage-001",
              stageCode: "estimate",
              stageName: "投资估算",
              status: "active",
              sequenceNo: 1,
            },
          ],
          disciplines: [
            {
              id: "discipline-001",
              code: "building",
              name: "建筑工程",
            },
          ],
          billVersions: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "draft",
              updatedAt: "2026-04-18T09:00:00.000Z",
              current: true,
            },
          ],
          todoSummary: {
            totalCount: 2,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 1,
            items: ["1 条审核待处理", "1 条过程单据仍在草稿"],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 1,
            failedJobCount: 0,
            items: ["1 条过程单据被退回"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 1,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "job-001",
              name: "审计日志筛选导入",
              status: "processing",
              failureReason: "missing_field",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
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
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: ["estimate"],
              visibleDisciplineCodes: ["building"],
            },
          },
          recentActivities: [],
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({
          items: [],
        });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 0,
          totalFinalAmount: 0,
          varianceAmount: 0,
          itemCount: 0,
          billVersionCount: 0,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("最近协作动作：过程单据页复制了过程单据待审核入口")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "回到过程单据页（待审核）" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?filter=submitted&summaryFocus=submitted",
    );
    expect(screen.getByRole("link", { name: "回到过程单据页（待审核）" })).toHaveClass(
      "recent-processing-action-link-primary",
    );
  });

  test("shows a semantic return action for draft process document source in recent collaboration summary", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/process-documents?filter=draft&summaryFocus=draft",
      label: "过程单据草稿入口",
      sourceLabel: "过程单据页",
    });

    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: {
            id: "stage-001",
            stageCode: "estimate",
            stageName: "投资估算",
            status: "active",
            sequenceNo: 1,
          },
          availableStages: [{ id: "stage-001", stageCode: "estimate", stageName: "投资估算", status: "active", sequenceNo: 1 }],
          disciplines: [{ id: "discipline-001", code: "building", name: "建筑工程" }],
          billVersions: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "draft",
              updatedAt: "2026-04-18T09:00:00.000Z",
              current: true,
            },
          ],
          todoSummary: {
            totalCount: 2,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 1,
            items: ["1 条审核待处理", "1 条过程单据仍在草稿"],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 1,
            failedJobCount: 0,
            items: ["1 条过程单据被退回"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 1,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "job-001",
              name: "审计日志筛选导入",
              status: "processing",
              failureReason: "missing_field",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
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
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: ["estimate"],
              visibleDisciplineCodes: ["building"],
            },
          },
          recentActivities: [],
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 0,
          totalFinalAmount: 0,
          varianceAmount: 0,
          itemCount: 0,
          billVersionCount: 0,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("最近协作动作：过程单据页复制了过程单据草稿入口")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "回到过程单据页（草稿）" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?filter=draft&summaryFocus=draft",
    );
  });

  test("shows a semantic return action for rejected process document source in recent collaboration summary", async () => {
    saveRecentProcessingLink({
      projectId: "project-001",
      path: "/projects/project-001/process-documents?filter=rejected&summaryFocus=rejected",
      label: "过程单据已驳回入口",
      sourceLabel: "过程单据页",
    });

    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: {
            id: "stage-001",
            stageCode: "estimate",
            stageName: "投资估算",
            status: "active",
            sequenceNo: 1,
          },
          availableStages: [{ id: "stage-001", stageCode: "estimate", stageName: "投资估算", status: "active", sequenceNo: 1 }],
          disciplines: [{ id: "discipline-001", code: "building", name: "建筑工程" }],
          billVersions: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              status: "draft",
              updatedAt: "2026-04-18T09:00:00.000Z",
              current: true,
            },
          ],
          todoSummary: {
            totalCount: 2,
            pendingReviewCount: 1,
            pendingProcessDocumentCount: 0,
            draftProcessDocumentCount: 1,
            items: ["1 条审核待处理", "1 条过程单据仍在草稿"],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 1,
            failedJobCount: 0,
            items: ["1 条过程单据被退回"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 1,
            queuedCount: 0,
            processingCount: 1,
            completedCount: 0,
            failedCount: 1,
            latestTask: {
              id: "job-001",
              name: "审计日志筛选导入",
              status: "processing",
              failureReason: "missing_field",
            },
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
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
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: ["estimate"],
              visibleDisciplineCodes: ["building"],
            },
          },
          recentActivities: [],
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 0,
          totalFinalAmount: 0,
          varianceAmount: 0,
          itemCount: 0,
          billVersionCount: 0,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("最近协作动作：过程单据页复制了过程单据已驳回入口")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "回到过程单据页（已驳回）" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?filter=rejected&summaryFocus=rejected",
    );
  });

  test("shows batch refresh notice for review and process document rounds", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
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
            note: "note",
          },
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({
          items: [
            {
              id: "audit-log-001",
              projectId: "project-001",
              stageCode: "estimate",
              resourceType: "review_submission",
              resourceId: "review-001",
              action: "approve",
              operatorId: "user-001",
              beforePayload: { status: "pending" },
              afterPayload: { status: "approved" },
              createdAt: "2026-04-18T13:00:00.000Z",
            },
            {
              id: "audit-log-002",
              projectId: "project-001",
              stageCode: "budget",
              resourceType: "review_submission",
              resourceId: "review-002",
              action: "approve",
              operatorId: "user-001",
              beforePayload: { status: "pending" },
              afterPayload: { status: "approved" },
              createdAt: "2026-04-18T13:05:00.000Z",
            },
            {
              id: "audit-log-003",
              projectId: "project-001",
              stageCode: "estimate",
              resourceType: "process_document",
              resourceId: "doc-001",
              action: "approve",
              operatorId: "user-001",
              beforePayload: { status: "submitted" },
              afterPayload: { status: "approved" },
              createdAt: "2026-04-18T13:10:00.000Z",
            },
            {
              id: "audit-log-004",
              projectId: "project-001",
              stageCode: "budget",
              resourceType: "process_document",
              resourceId: "doc-002",
              action: "approve",
              operatorId: "user-001",
              beforePayload: { status: "submitted" },
              afterPayload: { status: "approved" },
              createdAt: "2026-04-18T13:15:00.000Z",
            },
          ],
        });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 0,
          totalFinalAmount: 0,
          varianceAmount: 0,
          itemCount: 0,
          billVersionCount: 0,
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    const firstRender = render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001?refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002,review-001",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过，工作台摘要和最近动态已刷新。"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("本轮处理对象")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "预算版 V2已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-002&action=approve",
    );
    expect(screen.getByRole("link", { name: "估算版 V1已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-001&action=approve",
    );
    expect(screen.getAllByText("审核 · 已通过")).toHaveLength(2);
    expect(
      screen
        .getAllByText("审核 · 已通过")
        .filter((node) => node.closest(".activity-item")?.classList.contains("selected")),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "收起提示" }));
    await waitFor(() => {
      expect(
        screen.getByText("最近协作动作：项目工作台记录了本轮已处理 2 条审核：预算版 V2已通过、估算版 V1已通过"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("本轮对象：2 条")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "本轮来源：已在此处"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开本轮对象（2）" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "预算版 V2已通过" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开本轮对象（2）" }));
    expect(screen.getByRole("button", { name: "收起本轮对象（2）" })).toBeInTheDocument();
    expect(screen.getByText("审核对象：", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "预算版 V2已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-002&action=approve",
    );
    expect(screen.getByRole("link", { name: "估算版 V1已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/reviews?reviewId=review-001&action=approve",
    );
    expect(screen.getByRole("link", { name: "打开最近协作入口" })).toHaveAttribute(
      "href",
      "/projects/project-001?refresh=reviews&resultStatus=approved&resultName=%E9%A2%84%E7%AE%97%E7%89%88+V2&resultKind=review&resultId=review-002&batchCount=2&batchSummary=%E9%A2%84%E7%AE%97%E7%89%88+V2%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E4%BC%B0%E7%AE%97%E7%89%88+V1%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=review-002%2Creview-001",
    );

    firstRender.unmount();

    render(
      <MemoryRouter
        initialEntries={[
          "/projects/project-001?refresh=process-documents&resultStatus=approved&resultName=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95&resultKind=process-document&resultId=doc-002&batchCount=2&batchSummary=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=doc-002,doc-001",
        ]}
      >
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("本轮已处理 2 条过程单据：现场签证单已通过、设计变更单已通过，工作台摘要和最近动态已刷新。"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("本轮处理对象")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "现场签证单已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-002&action=approve",
    );
    expect(screen.getByRole("link", { name: "设计变更单已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-001&action=approve",
    );
    expect(screen.getAllByText("过程单据 · 已通过")).toHaveLength(2);
    expect(
      screen
        .getAllByText("过程单据 · 已通过")
        .filter((node) => node.closest(".activity-item")?.classList.contains("selected")),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "收起提示" }));
    await waitFor(() => {
      expect(
        screen.getByText("最近协作动作：项目工作台记录了本轮已处理 2 条过程单据：现场签证单已通过、设计变更单已通过"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("本轮对象：2 条")).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "本轮来源：已在此处"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开本轮对象（2）" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开本轮对象（2）" }));
    expect(screen.getByText("过程单据对象：", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "现场签证单已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-002&action=approve",
    );
    expect(screen.getByRole("link", { name: "设计变更单已通过" })).toHaveAttribute(
      "href",
      "/projects/project-001/process-documents?documentId=doc-001&action=approve",
    );
    expect(screen.getByRole("link", { name: "打开最近协作入口" })).toHaveAttribute(
      "href",
      "/projects/project-001?refresh=process-documents&resultStatus=approved&resultName=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95&resultKind=process-document&resultId=doc-002&batchCount=2&batchSummary=%E7%8E%B0%E5%9C%BA%E7%AD%BE%E8%AF%81%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87%E3%80%81%E8%AE%BE%E8%AE%A1%E5%8F%98%E6%9B%B4%E5%8D%95%E5%B7%B2%E9%80%9A%E8%BF%87&batchIds=doc-002%2Cdoc-001",
    );
  });

  test("removes invalid failureReason from project detail URL", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
          todoSummary: {
            totalCount: 0,
            pendingReviewCount: 0,
            pendingProcessDocumentCount: 1,
            draftProcessDocumentCount: 0,
            items: ["1 条过程单据待审核"],
          },
          riskSummary: {
            totalCount: 1,
            rejectedReviewCount: 0,
            rejectedProcessDocumentCount: 1,
            failedJobCount: 0,
            items: ["1 条过程单据被退回"],
          },
          importStatus: {
            mode: "import_task",
            totalCount: 0,
            queuedCount: 0,
            processingCount: 0,
            completedCount: 0,
            failedCount: 0,
            latestTask: null,
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
        });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 0,
          totalFinalAmount: 0,
          varianceAmount: 0,
          itemCount: 0,
          billVersionCount: 0,
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({ items: [] });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001?failureReason=broken_code"]}>
        <Routes>
          <Route
            path="/projects/:projectId"
            element={
              <>
                <ProjectDetailPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "新点造价项目" })).toBeInTheDocument();
    });

    expect(screen.getAllByTestId("location-search").at(-1)).toHaveTextContent("");
  });

  test("parses Excel source bill workbooks by QdList Qdxm and Gznr sheets", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: {
            id: "stage-001",
            stageCode: "bid_bill",
            stageName: "招标清单",
            status: "active",
            sequenceNo: 1,
          },
          availableStages: [
            {
              id: "stage-001",
              stageCode: "bid_bill",
              stageName: "招标清单",
              status: "active",
              sequenceNo: 1,
            },
          ],
          disciplines: [
            {
              id: "discipline-001",
              disciplineCode: "building",
              disciplineName: "建筑工程",
              status: "enabled",
            },
          ],
          billVersions: [],
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: ["bid_bill"],
              visibleDisciplineCodes: ["building"],
            },
          },
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
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
        });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 0,
          totalFinalAmount: 0,
          varianceAmount: 0,
          itemCount: 0,
          billVersionCount: 0,
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({ items: [] });
      }

      if (
        url.pathname === "/v1/projects/project-001/bill-imports/source/preview" &&
        init?.method === "POST"
      ) {
        const payload = JSON.parse(String(init.body ?? "{}")) as {
          sourceFileName?: string;
          sourceTables: {
            ZaoJia_Qd_QdList: Array<Record<string, unknown>>;
            ZaoJia_Qd_Qdxm: Array<Record<string, unknown>>;
            ZaoJia_Qd_Gznr: Array<Record<string, unknown>>;
          };
        };
        expect(payload.sourceFileName).toBe("source-bill.xlsx");
        expect(payload.sourceTables.ZaoJia_Qd_QdList).toEqual([
          { QdID: "list-001", Qdmc: "招标清单", QdGf: "GB50500-2013" },
        ]);
        expect(payload.sourceTables.ZaoJia_Qd_Qdxm).toEqual([
          {
            QdID: "item-001",
            Qdbh: "010101001001",
            Xmmc: "平整场地",
            Dw: "m2",
            Gcl: "120",
          },
        ]);
        expect(payload.sourceTables.ZaoJia_Qd_Gznr).toEqual([
          { QdID: "item-001", Gznr: "清理、平整" },
        ]);

        return createJsonResponse({
          summary: {
            versionCount: 1,
            billItemCount: 1,
            workItemCount: 1,
            failedItemCount: 0,
            measureItemCount: 0,
            feeItemCount: 0,
            featureItemCount: 0,
            quotaClueCount: 0,
            failureDetails: [],
          },
          failedItems: [],
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("选择源清单文件")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("选择源清单文件"), {
      target: { files: [createSourceBillWorkbookFile()] },
    });
    expect(await screen.findByText("已选择 source-bill.xlsx，请先预览确认。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "预览导入" }));

    expect(await screen.findByText("源清单导入预览")).toBeInTheDocument();
    expect(screen.getByText(/版本 1 · 清单项 1 · 工作内容 1 · 失败 0/)).toBeInTheDocument();
  });

  test("rejects legacy xls source bill workbooks with a clear compatibility message", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: null,
          availableStages: [],
          disciplines: [],
          billVersions: [],
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: [],
              visibleDisciplineCodes: [],
            },
          },
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
            note: "导入状态已切换为正式导入任务模型，工作台摘要与导入任务记录保持一致。",
          },
        });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 0,
          totalFinalAmount: 0,
          varianceAmount: 0,
          itemCount: 0,
          billVersionCount: 0,
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({ items: [] });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("选择源清单文件")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("选择源清单文件"), {
      target: { files: [createLegacySourceBillWorkbookFile()] },
    });

    expect(
      await screen.findByText(
        "暂不支持 Excel 97-2003 .xls 源清单文件，请先另存为 .xlsx、CSV 或 JSON 后再导入。",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/bill-imports/source/preview"),
      expect.anything(),
    );
  });

  test("shows bill version lock and unlock actions from workspace status", async () => {
    let isLocked = false;

    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));

      if (url.pathname === "/v1/projects/project-001/workspace") {
        return createJsonResponse({
          project: {
            id: "project-001",
            code: "PRJ-001",
            name: "新点造价项目",
            status: "draft",
          },
          currentStage: {
            id: "stage-001",
            stageCode: "estimate",
            stageName: "投资估算",
            status: isLocked ? "locked" : "approved",
            sequenceNo: 1,
          },
          availableStages: [],
          disciplines: [],
          billVersions: [
            {
              id: "version-001",
              versionName: "估算版 V1",
              stageCode: "estimate",
              disciplineCode: "building",
              versionStatus: isLocked ? "locked" : "approved",
            },
          ],
          currentUser: {
            userId: "user-001",
            displayName: "Owner User",
            memberId: "member-001",
            permissionSummary: {
              roleCode: "project_owner",
              roleLabel: "项目负责人",
              canManageProject: true,
              canEditProject: true,
              scopeSummary: ["项目全部范围"],
              visibleStageCodes: ["estimate"],
              visibleDisciplineCodes: ["building"],
            },
          },
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
            note: "note",
          },
        });
      }

      if (url.pathname === "/v1/reports/summary") {
        return createJsonResponse({
          totalSystemAmount: 0,
          totalFinalAmount: 0,
          varianceAmount: 0,
          itemCount: 0,
          billVersionCount: 1,
        });
      }

      if (url.pathname === "/v1/projects/project-001/audit-logs") {
        return createJsonResponse({ items: [] });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/lock") {
        expect(init?.method).toBe("POST");
        isLocked = true;
        return createJsonResponse({
          id: "version-001",
          versionName: "估算版 V1",
          stageCode: "estimate",
          disciplineCode: "building",
          versionStatus: "locked",
        });
      }

      if (url.pathname === "/v1/projects/project-001/bill-versions/version-001/unlock") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ reason: "项目工作台解锁" });
        isLocked = false;
        return createJsonResponse({
          id: "version-001",
          versionName: "估算版 V1",
          stageCode: "estimate",
          disciplineCode: "building",
          versionStatus: "editable",
        });
      }

      throw new Error(`Unhandled fetch: ${url.pathname}${url.search}`);
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-001"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "锁定版本" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "锁定版本" }));

    await waitFor(() => {
      expect(screen.getByText("估算版 V1 已锁定。")).toBeInTheDocument();
    });
    expect(screen.getByText("已锁定")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "解锁版本" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "解锁版本" }));

    await waitFor(() => {
      expect(screen.getByText("估算版 V1 已解锁。")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "锁定版本" })).toBeInTheDocument();
  });
});
