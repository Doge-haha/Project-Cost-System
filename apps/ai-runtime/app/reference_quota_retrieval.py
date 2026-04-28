from __future__ import annotations

import json
import tarfile
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class SnapshotManifest:
    path: str
    exists: bool
    vector_size: int | None
    distance: str | None
    payload_schema: dict[str, str]
    segment_count: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def inspect_qdrant_snapshot(snapshot_path: str | Path) -> SnapshotManifest:
    path = Path(snapshot_path)
    if not path.exists():
        return SnapshotManifest(
            path=str(path),
            exists=False,
            vector_size=None,
            distance=None,
            payload_schema={},
            segment_count=0,
        )

    with tarfile.open(path) as archive:
        names = archive.getnames()
        config = _read_json_member(archive, "config.json")
        payload_index = _read_json_member(archive, "payload_index.json")

    vectors = config.get("params", {}).get("vectors", {})
    schema = payload_index.get("schema", {})
    return SnapshotManifest(
        path=str(path),
        exists=True,
        vector_size=_optional_int(vectors.get("size")),
        distance=vectors.get("distance") if isinstance(vectors.get("distance"), str) else None,
        payload_schema={
            key: str(value)
            for key, value in schema.items()
            if isinstance(key, str)
        },
        segment_count=sum(1 for name in names if name.startswith("0/segments/")),
    )


def retrieve_reference_quota_candidates(input_payload: dict[str, Any]) -> dict[str, Any]:
    query = str(input_payload.get("query") or "").strip()
    if not query:
        raise ValueError("query is required")
    records = input_payload.get("records")
    if not isinstance(records, list):
        raise ValueError("records must be a list")

    limit = input_payload.get("limit")
    if not isinstance(limit, int) or limit <= 0:
        limit = 10

    snapshot_path = input_payload.get("snapshotPath")
    manifest = (
        inspect_qdrant_snapshot(snapshot_path)
        if isinstance(snapshot_path, str) and snapshot_path.strip()
        else None
    )
    qdrant_result = _try_qdrant_search(
        input_payload=input_payload,
        limit=limit,
        manifest=manifest,
    )
    if qdrant_result is not None:
        return qdrant_result

    query_terms = _tokenize(query)
    candidates = []
    for record in records:
        if not isinstance(record, dict):
            continue
        text = " ".join(
            str(record.get(key) or "")
            for key in (
                "quotaCode",
                "quotaName",
                "workContentSummary",
                "resourceCompositionSummary",
                "searchText",
            )
        )
        score = _score_text(query_terms, text)
        if score <= 0:
            continue
        candidates.append(
            {
                **record,
                "matchScore": score,
                "matchReason": _match_reason(manifest),
                "semanticBackend": "qdrant_snapshot_manifest"
                if manifest and manifest.exists
                else "text_fallback",
            }
        )

    candidates.sort(
        key=lambda item: (
            -float(item.get("matchScore") or 0),
            str(item.get("quotaCode") or ""),
        )
    )
    return {
        "query": query,
        "matchMode": "semantic_text_fallback",
        "snapshot": manifest.to_dict() if manifest else None,
        "items": candidates[:limit],
        "summary": {
            "inputCount": len(records),
            "matchedCount": len(candidates),
            "returnedCount": min(len(candidates), limit),
        },
    }


def _read_json_member(archive: tarfile.TarFile, name: str) -> dict[str, Any]:
    try:
        member = archive.extractfile(name)
    except KeyError:
        return {}
    if member is None:
        return {}
    return json.loads(member.read().decode("utf-8"))


def _try_qdrant_search(
    *,
    input_payload: dict[str, Any],
    limit: int,
    manifest: SnapshotManifest | None,
) -> dict[str, Any] | None:
    qdrant_url = input_payload.get("qdrantUrl")
    collection = input_payload.get("collection")
    query_vector = input_payload.get("queryVector")
    if (
        not isinstance(qdrant_url, str)
        or not qdrant_url.strip()
        or not isinstance(collection, str)
        or not collection.strip()
        or not _is_number_list(query_vector)
    ):
        return None

    request_payload = {
        "vector": query_vector,
        "limit": limit,
        "with_payload": True,
    }
    response_payload = _post_json(
        f"{qdrant_url.rstrip('/')}/collections/{collection}/points/search",
        request_payload,
        timeout=float(input_payload.get("timeoutSeconds") or 3),
    )
    points = response_payload.get("result")
    if not isinstance(points, list):
        return None

    items = []
    for point in points:
        if not isinstance(point, dict):
            continue
        payload = point.get("payload")
        if not isinstance(payload, dict):
            payload = {}
        item = _payload_to_candidate(payload)
        item["matchScore"] = point.get("score")
        item["matchReason"] = "AI Runtime 语义召回（Qdrant 向量近邻）"
        item["semanticBackend"] = "qdrant"
        items.append(item)

    return {
        "query": str(input_payload.get("query") or "").strip(),
        "matchMode": "semantic_qdrant",
        "snapshot": manifest.to_dict() if manifest else None,
        "items": items,
        "summary": {
            "inputCount": len(points),
            "matchedCount": len(items),
            "returnedCount": len(items),
        },
    }


def _post_json(url: str, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.URLError, json.JSONDecodeError):
        return {}


def _payload_to_candidate(payload: dict[str, Any]) -> dict[str, Any]:
    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    names = metadata.get("names")
    quota_name = _first_string(names) or _optional_payload_string(payload.get("content"))
    return {
        "sourceDataset": _optional_payload_string(metadata.get("source_dataset"))
        or "qdrant_snapshot",
        "sourceRegion": _optional_payload_string(metadata.get("region")),
        "quotaCode": _optional_payload_string(metadata.get("rate_code"))
        or _optional_payload_string(metadata.get("point_uuid")),
        "quotaName": quota_name,
        "unit": _optional_payload_string(metadata.get("unit")),
        "workContentSummary": _optional_payload_string(payload.get("content")),
        "metadata": metadata,
    }


def _optional_payload_string(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _first_string(value: Any) -> str | None:
    if isinstance(value, str) and value:
        return value
    if isinstance(value, list):
        for item in value:
            if isinstance(item, str) and item:
                return item
    return None


def _is_number_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(item, int | float) for item in value)


def _optional_int(value: Any) -> int | None:
    return value if isinstance(value, int) else None


def _tokenize(value: str) -> set[str]:
    normalized = value.lower()
    terms = {term for term in normalized.replace("/", " ").split() if term}
    terms.update(char for char in normalized if "\u4e00" <= char <= "\u9fff")
    return terms


def _score_text(query_terms: set[str], text: str) -> float:
    if not query_terms:
        return 0
    target_terms = _tokenize(text)
    if not target_terms:
        return 0
    matched = query_terms.intersection(target_terms)
    if not matched:
        return 0
    return round(len(matched) / len(query_terms), 4)


def _match_reason(manifest: SnapshotManifest | None) -> str:
    if manifest and manifest.exists:
        return "AI Runtime 语义召回（Qdrant snapshot 元数据已识别，文本回退排序）"
    return "AI Runtime 语义召回（文本回退排序）"
