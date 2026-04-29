from __future__ import annotations

import json
import os
import socket
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


class LlmProviderError(ValueError):
    def __init__(self, code: str, message: str, *, retryable: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable


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


def generate_llm_completion(input_payload: dict[str, Any]) -> dict[str, Any]:
    messages = input_payload.get("messages")
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must be a non-empty list")
    if not all(_is_message(message) for message in messages):
        raise ValueError("messages must contain role/content objects")

    api_key = _optional_string(input_payload.get("apiKey")) or _optional_string(
        os.getenv("LLM_API_KEY")
    )
    config = describe_llm_provider(input_payload)
    if not api_key or not config.model:
        raise ValueError("LLM_API_KEY and LLM_MODEL are required")

    request_payload: dict[str, Any] = {
        "model": config.model,
        "messages": messages,
        "temperature": _number_or_default(input_payload.get("temperature"), 0.2),
    }
    max_tokens = input_payload.get("maxTokens")
    if isinstance(max_tokens, int) and max_tokens > 0:
        request_payload["max_tokens"] = max_tokens

    response_payload, attempts = _post_json_with_retries(
        url=f"{config.base_url}/chat/completions",
        payload=request_payload,
        api_key=api_key,
        timeout=_number_or_default(input_payload.get("timeoutSeconds"), 15),
        retry_count=_integer_or_default(input_payload.get("retryCount"), 1),
        retry_delay_seconds=_number_or_default(
            input_payload.get("retryDelaySeconds"),
            0,
        ),
    )
    content = _extract_content(response_payload)
    return {
        "provider": config.to_dict(),
        "content": content,
        "attempts": attempts,
        "raw": response_payload if input_payload.get("includeRaw") is True else None,
        "usage": response_payload.get("usage") if isinstance(response_payload, dict) else None,
    }


def _post_json_with_retries(
    *,
    url: str,
    payload: dict[str, Any],
    api_key: str,
    timeout: float,
    retry_count: int,
    retry_delay_seconds: float,
) -> tuple[dict[str, Any], int]:
    attempts = max(1, min(retry_count + 1, 4))
    last_error: LlmProviderError | None = None
    for attempt in range(1, attempts + 1):
        try:
            return _post_json(url, payload, api_key=api_key, timeout=timeout), attempt
        except LlmProviderError as error:
            last_error = error
            if not error.retryable or attempt == attempts:
                raise
            if retry_delay_seconds > 0:
                time.sleep(retry_delay_seconds)

    if last_error:
        raise last_error
    raise LlmProviderError("AI_TASK_UNKNOWN_FAILURE", "LLM provider request failed")


def _post_json(
    url: str,
    payload: dict[str, Any],
    *,
    api_key: str,
    timeout: float,
) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "authorization": f"Bearer {api_key}",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        code, retryable = _classify_http_error(error.code)
        raise LlmProviderError(
            code,
            f"LLM provider error: {error.code} {body}",
            retryable=retryable,
        ) from error
    except json.JSONDecodeError as error:
        raise LlmProviderError(
            "AI_PROVIDER_BAD_RESPONSE",
            f"LLM provider returned invalid JSON: {error}",
        ) from error
    except (TimeoutError, socket.timeout) as error:
        raise LlmProviderError(
            "AI_PROVIDER_TIMEOUT",
            f"LLM provider request timed out: {error}",
            retryable=True,
        ) from error
    except urllib.error.URLError as error:
        code = "AI_PROVIDER_TIMEOUT" if _is_timeout_reason(error.reason) else "AI_PROVIDER_UNAVAILABLE"
        raise LlmProviderError(
            code,
            f"LLM provider request failed: {error}",
            retryable=True,
        ) from error
    except OSError as error:
        raise LlmProviderError(
            "AI_PROVIDER_UNAVAILABLE",
            f"LLM provider request failed: {error}",
            retryable=True,
        ) from error


def _extract_content(response_payload: dict[str, Any]) -> str:
    choices = response_payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise LlmProviderError(
            "AI_PROVIDER_BAD_RESPONSE",
            "LLM provider response missing choices",
        )
    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise LlmProviderError(
            "AI_PROVIDER_BAD_RESPONSE",
            "LLM provider response has invalid choice",
        )
    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise LlmProviderError(
            "AI_PROVIDER_BAD_RESPONSE",
            "LLM provider response missing message",
        )
    content = message.get("content")
    if not isinstance(content, str):
        raise LlmProviderError(
            "AI_PROVIDER_BAD_RESPONSE",
            "LLM provider response missing content",
        )
    return content


def _classify_http_error(status_code: int) -> tuple[str, bool]:
    if status_code == 408:
        return "AI_PROVIDER_TIMEOUT", True
    if status_code == 429:
        return "AI_PROVIDER_RATE_LIMITED", True
    if status_code >= 500:
        return "AI_PROVIDER_UNAVAILABLE", True
    return "AI_PROVIDER_BAD_RESPONSE", False


def _is_timeout_reason(reason: Any) -> bool:
    return isinstance(reason, TimeoutError | socket.timeout) or "timed out" in str(
        reason,
    ).lower()


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


def _integer_or_default(value: Any, default: int) -> int:
    return value if isinstance(value, int) and value >= 0 else default
