from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class KnowledgeCandidate:
    title: str
    summary: str
    source_type: str
    source_action: str
    project_id: str
    stage_code: str | None
    tags: tuple[str, ...]
    metadata: dict[str, Any]


@dataclass(frozen=True)
class MemoryCandidate:
    memory_key: str
    subject_type: str
    subject_id: str
    content: str
    project_id: str
    stage_code: str | None
    metadata: dict[str, Any]


@dataclass(frozen=True)
class ExtractionResult:
    knowledge_candidates: tuple[KnowledgeCandidate, ...]
    memory_candidates: tuple[MemoryCandidate, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "knowledgeCandidates": [asdict(item) for item in self.knowledge_candidates],
            "memoryCandidates": [asdict(item) for item in self.memory_candidates],
        }


@dataclass(frozen=True)
class BatchExtractionResult:
    knowledge_candidates: tuple[KnowledgeCandidate, ...]
    memory_candidates: tuple[MemoryCandidate, ...]
    summary: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "knowledgeCandidates": [asdict(item) for item in self.knowledge_candidates],
            "memoryCandidates": [asdict(item) for item in self.memory_candidates],
            "summary": self.summary,
        }


def extract_candidates(event: dict[str, Any]) -> ExtractionResult:
    resource_type = str(event.get("resourceType") or "unknown")
    action = str(event.get("action") or "unknown")
    project_id = str(event.get("projectId") or "")
    if not project_id:
        raise ValueError("projectId is required")

    stage_code = _optional_string(event.get("stageCode"))
    operator_id = _optional_string(event.get("operatorId"))
    resource_id = _optional_string(event.get("resourceId")) or "unknown"
    payload = _normalize_payload(event.get("afterPayload"))

    knowledge_candidates: list[KnowledgeCandidate] = []
    memory_candidates: list[MemoryCandidate] = []

    if resource_type == "review_submission":
        candidate = _extract_review_knowledge(
            action=action,
            payload=payload,
            project_id=project_id,
            stage_code=stage_code,
        )
        if candidate is not None:
            knowledge_candidates.append(candidate)

    if resource_type == "process_document":
        candidate = _extract_process_document_knowledge(
            action=action,
            payload=payload,
            project_id=project_id,
            stage_code=stage_code,
        )
        if candidate is not None:
            knowledge_candidates.append(candidate)

    if resource_type == "bill_version":
        candidate = _extract_bill_version_knowledge(
            action=action,
            payload=payload,
            project_id=project_id,
            stage_code=stage_code,
        )
        if candidate is not None:
            knowledge_candidates.append(candidate)

    if operator_id is not None and resource_type in {
        "bill_item",
        "bill_version",
        "quota_line",
        "project",
        "review_submission",
    }:
        memory_candidates.append(
            MemoryCandidate(
                memory_key=f"{project_id}:{operator_id}:{resource_type}:{action}",
                subject_type="user",
                subject_id=operator_id,
                content=_build_memory_content(resource_type, action, payload),
                project_id=project_id,
                stage_code=stage_code,
                metadata={
                    "resourceType": resource_type,
                    "action": action,
                    "resourceId": resource_id,
                },
            )
        )

    return ExtractionResult(
        knowledge_candidates=tuple(knowledge_candidates),
        memory_candidates=tuple(memory_candidates),
    )


def extract_candidates_batch(events: list[dict[str, Any]]) -> BatchExtractionResult:
    all_knowledge_candidates: list[KnowledgeCandidate] = []
    memory_candidates_by_key: dict[str, MemoryCandidate] = {}
    processed_events = 0
    skipped_events = 0

    for event in events:
        try:
            extraction_result = extract_candidates(event)
        except ValueError:
            skipped_events += 1
            continue

        processed_events += 1
        all_knowledge_candidates.extend(extraction_result.knowledge_candidates)
        for memory_candidate in extraction_result.memory_candidates:
            memory_candidates_by_key[memory_candidate.memory_key] = memory_candidate

    summary = {
        "inputCount": len(events),
        "processedCount": processed_events,
        "skippedCount": skipped_events,
        "knowledgeCount": len(all_knowledge_candidates),
        "memoryCount": len(memory_candidates_by_key),
    }
    return BatchExtractionResult(
        knowledge_candidates=tuple(all_knowledge_candidates),
        memory_candidates=tuple(memory_candidates_by_key.values()),
        summary=summary,
    )


def _extract_review_knowledge(
    *,
    action: str,
    payload: dict[str, Any],
    project_id: str,
    stage_code: str | None,
) -> KnowledgeCandidate | None:
    if action not in {"reject", "approve"}:
        return None

    reason = _optional_string(payload.get("reason")) or _optional_string(
        payload.get("rejectionReason")
    )
    comment = _optional_string(payload.get("comment")) or _optional_string(
        payload.get("reviewComment")
    )
    summary = reason or comment
    if summary is None:
        return None

    return KnowledgeCandidate(
        title=f"review_{action}",
        summary=summary.strip(),
        source_type="review_submission",
        source_action=action,
        project_id=project_id,
        stage_code=stage_code,
        tags=("review", action),
        metadata={"billVersionId": payload.get("billVersionId")},
    )


def _extract_process_document_knowledge(
    *,
    action: str,
    payload: dict[str, Any],
    project_id: str,
    stage_code: str | None,
) -> KnowledgeCandidate | None:
    if action not in {"approve", "reject", "submit"}:
        return None

    document_type = _optional_string(payload.get("documentType")) or "process_document"
    comment = _optional_string(payload.get("comment")) or _optional_string(
        payload.get("lastComment")
    )
    reference_no = _optional_string(payload.get("referenceNo"))

    summary_parts = [document_type.replace("_", " "), action]
    if reference_no is not None:
        summary_parts.append(reference_no)
    if comment is not None:
        summary_parts.append(comment.strip())

    return KnowledgeCandidate(
        title=f"{document_type}_{action}",
        summary=" | ".join(summary_parts),
        source_type="process_document",
        source_action=action,
        project_id=project_id,
        stage_code=stage_code,
        tags=("process_document", document_type, action),
        metadata={"amount": payload.get("amount")},
    )


def _extract_bill_version_knowledge(
    *,
    action: str,
    payload: dict[str, Any],
    project_id: str,
    stage_code: str | None,
) -> KnowledgeCandidate | None:
    if action not in {"submit", "withdraw", "lock"}:
        return None

    status = _optional_string(payload.get("status"))
    version_code = _optional_string(payload.get("versionCode")) or _optional_string(
        payload.get("code")
    )
    summary_parts = ["bill version", action]
    if version_code is not None:
        summary_parts.append(version_code)
    if status is not None:
        summary_parts.append(f"status={status}")

    return KnowledgeCandidate(
        title=f"bill_version_{action}",
        summary=" | ".join(summary_parts),
        source_type="bill_version",
        source_action=action,
        project_id=project_id,
        stage_code=stage_code,
        tags=("bill_version", action),
        metadata={
            "status": payload.get("status"),
            "versionCode": payload.get("versionCode"),
        },
    )


def _build_memory_content(
    resource_type: str,
    action: str,
    payload: dict[str, Any],
) -> str:
    important_fields = []
    for field_name in (
        "manualUnitPrice",
        "defaultPriceVersionId",
        "defaultFeeTemplateId",
        "comment",
        "reason",
    ):
        value = payload.get(field_name)
        if value is not None:
            important_fields.append(f"{field_name}={value}")

    suffix = f" ({', '.join(important_fields)})" if important_fields else ""
    return f"{resource_type}:{action}{suffix}"


def _normalize_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    return {}


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
