import { useMemo, useState } from "react";

import type { BillItem } from "../../lib/types";

export type BillTableRow = {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  indentLevel: number;
  isLeaf: boolean;
  quantity: number | string;
  unit: string;
  systemUnitPrice: number | string | null;
  manualUnitPrice: number | string | null;
  finalUnitPrice: number | string | null;
  systemAmount: number | string | null;
  finalAmount: number | string | null;
};

export function countLeafBillItems(items: BillItem[]) {
  const parentIds = new Set(
    items
      .map((item) => item.parentId ?? null)
      .filter((parentId): parentId is string => Boolean(parentId)),
  );

  return items.filter((item) => !parentIds.has(item.id)).length;
}

export function buildBillTableRows(items: BillItem[]): BillTableRow[] {
  const parentIds = new Set(
    items
      .map((item) => item.parentId ?? null)
      .filter((parentId): parentId is string => Boolean(parentId)),
  );

  return items.map((item) => ({
    id: item.id,
    parentId: item.parentId ?? null,
    code: item.code,
    name: item.name,
    indentLevel: Math.max((item.level ?? 1) - 1, 0),
    isLeaf: !parentIds.has(item.id),
    quantity: item.quantity,
    unit: item.unit,
    systemUnitPrice: item.systemUnitPrice ?? null,
    manualUnitPrice: item.manualUnitPrice ?? null,
    finalUnitPrice: item.finalUnitPrice ?? null,
    systemAmount: item.systemAmount ?? null,
    finalAmount: item.finalAmount ?? null,
  }));
}

export function getVisibleBillTableRows(
  rows: BillTableRow[],
  collapsedRowIds: Set<string>,
) {
  return rows.filter((row) => {
    let currentParentId = row.parentId;

    while (currentParentId) {
      if (collapsedRowIds.has(currentParentId)) {
        return false;
      }

      currentParentId =
        rows.find((candidate) => candidate.id === currentParentId)?.parentId ?? null;
    }

    return true;
  });
}

function formatMoney(value: number | string | null) {
  if (value === null || value === "") {
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

export function BillItemsTable(props: { items: BillItem[] }) {
  const rows = useMemo(() => buildBillTableRows(props.items), [props.items]);
  const [collapsedRowIds, setCollapsedRowIds] = useState<Set<string>>(new Set());
  const visibleRows = useMemo(
    () => getVisibleBillTableRows(rows, collapsedRowIds),
    [collapsedRowIds, rows],
  );

  return (
    <div className="bill-table-shell">
      <table className="bill-table">
        <thead>
          <tr>
            <th>编码</th>
            <th>名称</th>
            <th>工程量</th>
            <th>单位</th>
            <th>系统单价</th>
            <th>人工单价</th>
            <th>最终单价</th>
            <th>系统金额</th>
            <th>最终金额</th>
            <th>节点类型</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.id}>
              <td className="bill-table-code">{row.code}</td>
              <td>
                <div
                  className="bill-table-name"
                  style={{ paddingInlineStart: `${row.indentLevel * 20}px` }}
                >
                  {row.isLeaf ? (
                    <span className="bill-table-marker" aria-hidden="true">
                      •
                    </span>
                  ) : (
                    <button
                      aria-label={
                        collapsedRowIds.has(row.id)
                          ? `展开 ${row.name}`
                          : `折叠 ${row.name}`
                      }
                      className="bill-table-toggle"
                      onClick={() => {
                        setCollapsedRowIds((current) => {
                          const next = new Set(current);
                          if (next.has(row.id)) {
                            next.delete(row.id);
                          } else {
                            next.add(row.id);
                          }
                          return next;
                        });
                      }}
                      type="button"
                    >
                      {collapsedRowIds.has(row.id) ? "▸" : "▾"}
                    </button>
                  )}
                  <span>{row.name}</span>
                </div>
              </td>
              <td>{row.quantity}</td>
              <td>{row.unit}</td>
              <td>{formatMoney(row.systemUnitPrice)}</td>
              <td>{formatMoney(row.manualUnitPrice)}</td>
              <td>{formatMoney(row.finalUnitPrice)}</td>
              <td>{formatMoney(row.systemAmount)}</td>
              <td>{formatMoney(row.finalAmount)}</td>
              <td>{row.isLeaf ? "叶子节点" : "父级节点"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
