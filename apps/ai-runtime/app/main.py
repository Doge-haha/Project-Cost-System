from dataclasses import dataclass

from .knowledge_pipeline import extract_candidates, extract_candidates_batch
from .llm_provider import describe_llm_provider, generate_llm_completion
from .reference_quota_retrieval import (
    inspect_qdrant_snapshot,
    retrieve_reference_quota_candidates,
)


@dataclass(frozen=True)
class RuntimeDescriptor:
    name: str
    role: str


descriptor = RuntimeDescriptor(
    name="saas-pricing-ai-runtime",
    role="knowledge-memory-agent-runtime",
)


def describe_runtime() -> str:
    return f"{descriptor.name}:{descriptor.role}"


__all__ = [
    "RuntimeDescriptor",
    "descriptor",
    "describe_runtime",
    "describe_llm_provider",
    "extract_candidates",
    "extract_candidates_batch",
    "generate_llm_completion",
    "inspect_qdrant_snapshot",
    "retrieve_reference_quota_candidates",
]
