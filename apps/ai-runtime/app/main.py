from dataclasses import dataclass


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
