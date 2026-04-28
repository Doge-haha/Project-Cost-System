from __future__ import annotations

from typing import Any

from .knowledge_pipeline import extract_candidates_batch
from .llm_provider import generate_llm_completion
from .main import describe_runtime
from .reference_quota_retrieval import retrieve_reference_quota_candidates


def process_event_batch(input_payload: dict[str, Any]) -> dict[str, Any]:
    if input_payload.get("task") == "llm_chat":
        return {
            "runtime": describe_runtime(),
            "source": input_payload.get("source") or "llm_provider",
            "result": generate_llm_completion(input_payload),
        }

    if input_payload.get("task") == "reference_quota_semantic_search":
        return {
            "runtime": describe_runtime(),
            "source": input_payload.get("source") or "reference_quota",
            "result": retrieve_reference_quota_candidates(input_payload),
        }

    events = input_payload.get("events")
    if not isinstance(events, list):
        raise ValueError("events must be a list")

    extraction_result = extract_candidates_batch(events)
    return {
        "runtime": describe_runtime(),
        "source": input_payload.get("source") or "unknown",
        "result": extraction_result.to_dict(),
    }
