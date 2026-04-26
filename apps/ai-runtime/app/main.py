from dataclasses import dataclass

from .knowledge_pipeline import extract_candidates, extract_candidates_batch


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
    "extract_candidates",
    "extract_candidates_batch",
]
