from __future__ import annotations

from typing import Any

from .knowledge_pipeline import extract_candidates_batch
from .main import describe_runtime


def process_event_batch(input_payload: dict[str, Any]) -> dict[str, Any]:
    events = input_payload.get("events")
    if not isinstance(events, list):
        raise ValueError("events must be a list")

    extraction_result = extract_candidates_batch(events)
    return {
        "runtime": describe_runtime(),
        "source": input_payload.get("source") or "unknown",
        "result": extraction_result.to_dict(),
    }
