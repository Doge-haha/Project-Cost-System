import json
import tarfile
from pathlib import Path

import app.reference_quota_retrieval as retrieval
from app.reference_quota_retrieval import (
    inspect_qdrant_snapshot,
    retrieve_reference_quota_candidates,
)
from app.runtime_service import process_event_batch


def test_inspect_qdrant_snapshot_reads_vector_and_payload_metadata(tmp_path: Path) -> None:
    snapshot_path = tmp_path / "reference.snapshot"
    with tarfile.open(snapshot_path, "w") as archive:
        _add_json(
            archive,
            "config.json",
            {"params": {"vectors": {"size": 3072, "distance": "Cosine"}}},
        )
        _add_json(
            archive,
            "payload_index.json",
            {"schema": {"content": "text", "metadata.names": "text"}},
        )
        _add_json(archive, "0/segments/segment-a.tar", {})

    manifest = inspect_qdrant_snapshot(snapshot_path)

    assert manifest.exists is True
    assert manifest.vector_size == 3072
    assert manifest.distance == "Cosine"
    assert manifest.payload_schema == {"content": "text", "metadata.names": "text"}
    assert manifest.segment_count == 1


def test_retrieve_reference_quota_candidates_uses_text_fallback_with_snapshot_metadata(
    tmp_path: Path,
) -> None:
    snapshot_path = tmp_path / "reference.snapshot"
    with tarfile.open(snapshot_path, "w") as archive:
        _add_json(
            archive,
            "config.json",
            {"params": {"vectors": {"size": 3072, "distance": "Cosine"}}},
        )
        _add_json(archive, "payload_index.json", {"schema": {"content": "text"}})

    result = retrieve_reference_quota_candidates(
        {
            "query": "挖土 修边",
            "snapshotPath": str(snapshot_path),
            "records": [
                {
                    "quotaCode": "010101099",
                    "quotaName": "参考库人工挖土方",
                    "workContentSummary": "挖土、装土、修边",
                    "searchText": "参考库人工挖土方 挖土 装土 修边",
                },
                {
                    "quotaCode": "020201001",
                    "quotaName": "砌筑工程",
                    "searchText": "砌筑 砂浆",
                },
            ],
        }
    )

    assert result["snapshot"]["vector_size"] == 3072
    assert result["summary"] == {
        "inputCount": 2,
        "matchedCount": 1,
        "returnedCount": 1,
    }
    assert result["items"][0]["quotaCode"] == "010101099"
    assert result["items"][0]["semanticBackend"] == "qdrant_snapshot_manifest"


def test_process_event_batch_routes_reference_quota_semantic_search() -> None:
    result = process_event_batch(
        {
            "task": "reference_quota_semantic_search",
            "query": "挖土",
            "records": [
                {
                    "quotaCode": "010101099",
                    "quotaName": "参考库人工挖土方",
                    "searchText": "参考库人工挖土方 挖土",
                }
            ],
        }
    )

    assert result["source"] == "reference_quota"
    assert result["result"]["items"][0]["quotaCode"] == "010101099"


def test_retrieve_reference_quota_candidates_uses_qdrant_when_vector_is_provided(
    monkeypatch,
) -> None:
    def fake_post_json(url: str, payload: dict, timeout: float) -> dict:
        assert url == "http://qdrant.local/collections/reference_quota/points/search"
        assert payload["vector"] == [0.1, 0.2, 0.3]
        assert payload["limit"] == 2
        assert timeout == 1
        return {
            "result": [
                {
                    "score": 0.91,
                    "payload": {
                        "content": "挖土、装土、修边",
                        "metadata": {
                            "rate_code": "010101099",
                            "names": ["参考库人工挖土方"],
                            "unit": "m3",
                            "region": "上海",
                        },
                    },
                }
            ]
        }

    monkeypatch.setattr(retrieval, "_post_json", fake_post_json)

    result = retrieve_reference_quota_candidates(
        {
            "query": "挖土",
            "records": [],
            "qdrantUrl": "http://qdrant.local",
            "collection": "reference_quota",
            "queryVector": [0.1, 0.2, 0.3],
            "limit": 2,
            "timeoutSeconds": 1,
        }
    )

    assert result["matchMode"] == "semantic_qdrant"
    assert result["items"][0]["semanticBackend"] == "qdrant"
    assert result["items"][0]["quotaCode"] == "010101099"
    assert result["items"][0]["quotaName"] == "参考库人工挖土方"
    assert result["items"][0]["matchScore"] == 0.91


def _add_json(archive: tarfile.TarFile, name: str, payload: dict) -> None:
    data = json.dumps(payload).encode("utf-8")
    info = tarfile.TarInfo(name)
    info.size = len(data)
    archive.addfile(info, fileobj=_BytesReader(data))


class _BytesReader:
    def __init__(self, data: bytes) -> None:
        self._data = data
        self._offset = 0

    def read(self, size: int = -1) -> bytes:
        if size == -1:
            size = len(self._data) - self._offset
        chunk = self._data[self._offset : self._offset + size]
        self._offset += len(chunk)
        return chunk
