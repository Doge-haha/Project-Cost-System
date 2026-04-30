from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class LlmProviderConfig:
    provider: str
    base_url: str
    model: str
    configured: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def describe_llm_provider(input_payload: dict[str, Any] | None = None) -> LlmProviderConfig:
    payload = input_payload or {}
    api_key = _optional_string(payload.get("apiKey")) or _optional_string(
        os.getenv("LLM_API_KEY")
    )
    model = _optional_string(payload.get("model")) or _optional_string(
        os.getenv("LLM_MODEL")
    )
    base_url = (
        _optional_string(payload.get("baseUrl"))
        or _optional_string(os.getenv("LLM_BASE_URL"))
        or "https://api.openai.com/v1"
    )
    provider = (
        _optional_string(payload.get("provider"))
        or _optional_string(os.getenv("LLM_PROVIDER"))
        or "openai_compatible"
    )

    return LlmProviderConfig(
        provider=provider,
        base_url=base_url.rstrip("/"),
        model=model or "",
        configured=bool(api_key and model),
    )


def validate_llm_provider_config(input_payload: dict[str, Any] | None = None) -> None:
    payload = input_payload or {}
    api_key = _optional_string(payload.get("apiKey")) or _optional_string(
        os.getenv("LLM_API_KEY")
    )
    config = describe_llm_provider(payload)
    if config.provider != "openai_compatible":
        raise ValueError("LLM_PROVIDER must be openai_compatible")
    if not config.base_url.startswith(("http://", "https://")):
        raise ValueError("LLM_BASE_URL must be an http(s) URL")
    if not api_key:
        raise ValueError("LLM_API_KEY is required")
    if not config.model:
        raise ValueError("LLM_MODEL is required")


def generate_llm_completion(input_payload: dict[str, Any]) -> dict[str, Any]:
    messages = input_payload.get("messages")
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must be a non-empty list")
    if not all(_is_message(message) for message in messages):
        raise ValueError("messages must contain role/content objects")

    validate_llm_provider_config(input_payload)
    api_key = _optional_string(input_payload.get("apiKey")) or _optional_string(
        os.getenv("LLM_API_KEY")
    )
    config = describe_llm_provider(input_payload)

    request_payload: dict[str, Any] = {
        "model": config.model,
        "messages": messages,
        "temperature": _number_or_default(input_payload.get("temperature"), 0.2),
    }
    max_tokens = input_payload.get("maxTokens")
    if isinstance(max_tokens, int) and max_tokens > 0:
        request_payload["max_tokens"] = max_tokens

    response_payload, telemetry = _post_json(
        f"{config.base_url}/chat/completions",
        request_payload,
        api_key=api_key,
        timeout=float(input_payload.get("timeoutSeconds") or 15),
        retry_attempts=int(input_payload.get("retryAttempts") or 2),
    )
    content = _extract_content(response_payload)
    return {
        "provider": config.to_dict(),
        "content": content,
        "raw": response_payload if input_payload.get("includeRaw") is True else None,
        "usage": response_payload.get("usage") if isinstance(response_payload, dict) else None,
        "telemetry": telemetry,
    }


def check_llm_provider(input_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        validate_llm_provider_config(input_payload)
        config = describe_llm_provider(input_payload)
        return {
            **config.to_dict(),
            "healthy": True,
            "message": "LLM provider configuration is valid",
        }
    except ValueError as error:
        config = describe_llm_provider(input_payload)
        return {
            **config.to_dict(),
            "healthy": False,
            "configured": False,
            "message": str(error),
        }


def _post_json(
    url: str,
    payload: dict[str, Any],
    *,
    api_key: str,
    timeout: float,
    retry_attempts: int = 2,
) -> tuple[dict[str, Any], dict[str, Any]]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        },
        method="POST",
    )
    last_error: Exception | None = None
    started_at = time.monotonic()
    for attempt in range(max(1, retry_attempts + 1)):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8")), {
                    "durationMs": round((time.monotonic() - started_at) * 1000),
                    "retryCount": attempt,
                    "attemptCount": attempt + 1,
                }
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            if error.code < 500 or attempt >= retry_attempts:
                raise ValueError(f"LLM provider error: {error.code} {body}") from error
            last_error = error
        except (TimeoutError, urllib.error.URLError, OSError) as error:
            if attempt >= retry_attempts:
                raise ValueError(f"LLM provider request failed: {error}") from error
            last_error = error
        except json.JSONDecodeError as error:
            raise ValueError(f"LLM provider returned invalid JSON: {error}") from error

    raise ValueError(f"LLM provider request failed: {last_error}")


def _extract_content(response_payload: dict[str, Any]) -> str:
    choices = response_payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("LLM provider response missing choices")
    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise ValueError("LLM provider response has invalid choice")
    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise ValueError("LLM provider response missing message")
    content = message.get("content")
    if not isinstance(content, str):
        raise ValueError("LLM provider response missing content")
    return content


def _is_message(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("role"), str)
        and isinstance(value.get("content"), str)
        and value["role"] in {"system", "user", "assistant"}
    )


def _optional_string(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _number_or_default(value: Any, default: float) -> float:
    return value if isinstance(value, int | float) else default
