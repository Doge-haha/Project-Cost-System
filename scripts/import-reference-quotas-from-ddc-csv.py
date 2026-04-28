#!/usr/bin/env python3
"""Convert DDC-CWICR quota CSV rows into reference_quota COPY SQL."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from collections import OrderedDict
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path


@dataclass
class ReferenceQuota:
    source_dataset: str
    source_region: str
    standard_set_code: str
    discipline_code: str
    source_quota_id: str
    source_sequence: int | None
    chapter_code: str
    quota_code: str
    quota_name: str
    unit: str
    labor_fee: Decimal | None = None
    material_fee: Decimal | None = None
    machine_fee: Decimal | None = None
    work_content_summary: str | None = None
    resource_names: list[str] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--source-dataset", default=None)
    parser.add_argument("--source-region", default="上海")
    parser.add_argument("--standard-set-code", default="ddc-cwicr-shanghai")
    parser.add_argument("--discipline-code", default=None)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    quotas = read_reference_quotas(
        csv_path=args.csv_path,
        source_dataset=args.source_dataset or args.csv_path.name,
        source_region=args.source_region,
        standard_set_code=args.standard_set_code,
        discipline_code=args.discipline_code,
        limit=args.limit,
    )
    write_copy_sql(quotas.values(), sys.stdout)
    return 0


def read_reference_quotas(
    *,
    csv_path: Path,
    source_dataset: str,
    source_region: str,
    standard_set_code: str,
    discipline_code: str | None,
    limit: int | None,
) -> OrderedDict[str, ReferenceQuota]:
    quotas: OrderedDict[str, ReferenceQuota] = OrderedDict()
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for row_index, row in enumerate(reader, start=1):
            if limit is not None and row_index > limit:
                break

            quota_code = clean(row.get("rate_code"))
            quota_name = clean(row.get("rate_final_name")) or clean(
                row.get("rate_original_name")
            )
            unit = clean(row.get("rate_unit"))
            if not quota_code or not quota_name or not unit:
                continue

            key = "\x1f".join([standard_set_code, quota_code, quota_name, unit])
            quota = quotas.get(key)
            if quota is None:
                quota = ReferenceQuota(
                    source_dataset=source_dataset,
                    source_region=source_region,
                    standard_set_code=standard_set_code,
                    discipline_code=discipline_code or slug(clean(row.get("category_type"))),
                    source_quota_id=stable_id(source_dataset, quota_code, quota_name, unit),
                    source_sequence=len(quotas) + 1,
                    chapter_code=derive_chapter_code(row),
                    quota_code=quota_code,
                    quota_name=quota_name,
                    unit=unit,
                    work_content_summary=clean(row.get("work_composition_text")),
                    metadata={
                        "categoryType": clean(row.get("category_type")),
                        "collectionCode": clean(row.get("collection_code")),
                        "collectionName": clean(row.get("collection_name")),
                        "departmentCode": clean(row.get("department_code")),
                        "departmentName": clean(row.get("department_name")),
                        "subsectionCode": clean(row.get("subsection_code")),
                        "subsectionName": clean(row.get("subsection_name")),
                    },
                )
                quotas[key] = quota

            add_resource(quota, row)

    return quotas


def add_resource(quota: ReferenceQuota, row: dict[str, str]) -> None:
    resource_name = clean(row.get("resource_name"))
    if resource_name and resource_name not in quota.resource_names:
        quota.resource_names.append(resource_name)

    cost = decimal_or_none(row.get("resource_cost_eur")) or decimal_or_none(
        row.get("total_resource_cost_per_position")
    )
    if cost is None:
        return

    is_material = clean(row.get("is_material")).lower() == "true"
    is_machine = clean(row.get("is_machine")).lower() == "true"
    if is_machine:
        quota.machine_fee = add_decimal(quota.machine_fee, cost)
    elif is_material:
        quota.material_fee = add_decimal(quota.material_fee, cost)
    else:
        quota.labor_fee = add_decimal(quota.labor_fee, cost)


def write_copy_sql(quotas, output) -> None:
    columns = [
        "id",
        "source_dataset",
        "source_region",
        "standard_set_code",
        "discipline_code",
        "source_quota_id",
        "source_sequence",
        "chapter_code",
        "quota_code",
        "quota_name",
        "unit",
        "labor_fee",
        "material_fee",
        "machine_fee",
        "work_content_summary",
        "resource_composition_summary",
        "search_text",
        "metadata",
    ]
    output.write(
        "COPY reference_quota ("
        + ", ".join(columns)
        + ") FROM stdin WITH (FORMAT text);\n"
    )
    for quota in quotas:
        output.write("\t".join(copy_value(value) for value in quota_values(quota)) + "\n")
    output.write("\\.\n")


def quota_values(quota: ReferenceQuota) -> list[object | None]:
    resource_summary = build_resource_summary(quota)
    search_text = " ".join(
        item
        for item in [
            quota.quota_code,
            quota.quota_name,
            quota.work_content_summary,
            " ".join(quota.resource_names[:12]),
        ]
        if item
    )
    return [
        quota.source_quota_id,
        quota.source_dataset,
        quota.source_region,
        quota.standard_set_code,
        quota.discipline_code,
        quota.source_quota_id,
        quota.source_sequence,
        quota.chapter_code,
        quota.quota_code,
        quota.quota_name,
        quota.unit,
        quota.labor_fee,
        quota.material_fee,
        quota.machine_fee,
        quota.work_content_summary,
        resource_summary,
        search_text,
        json.dumps(
            {
                **quota.metadata,
                "resourceNames": quota.resource_names[:20],
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
    ]


def build_resource_summary(quota: ReferenceQuota) -> str | None:
    parts = []
    if quota.labor_fee is not None:
        parts.append(f"人工费 {quota.labor_fee}")
    if quota.material_fee is not None:
        parts.append(f"材料费 {quota.material_fee}")
    if quota.machine_fee is not None:
        parts.append(f"机械费 {quota.machine_fee}")
    return " / ".join(parts) if parts else None


def derive_chapter_code(row: dict[str, str]) -> str:
    for key in ("collection_code", "department_code", "subsection_code"):
        value = clean(row.get(key))
        if value:
            return value
    return "reference"


def clean(value: str | None) -> str:
    return (value or "").strip()


def decimal_or_none(value: str | None) -> Decimal | None:
    raw = clean(value)
    if not raw:
        return None
    try:
        return Decimal(raw)
    except InvalidOperation:
        return None


def add_decimal(left: Decimal | None, right: Decimal) -> Decimal:
    return (left or Decimal("0")) + right


def copy_value(value: object | None) -> str:
    if value is None or value == "":
        return r"\N"
    text = str(value)
    return (
        text.replace("\\", "\\\\")
        .replace("\t", "\\t")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
    )


def stable_id(*parts: str) -> str:
    digest = hashlib.sha1("\x1f".join(parts).encode("utf-8")).hexdigest()[:16]
    return f"reference-quota-{digest}"


def slug(value: str) -> str:
    if not value:
        return "reference"
    digest = hashlib.sha1(value.encode("utf-8")).hexdigest()[:8]
    return f"category-{digest}"


if __name__ == "__main__":
    raise SystemExit(main())
