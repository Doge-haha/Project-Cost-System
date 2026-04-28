from __future__ import annotations

import app.llm_provider as llm_provider
from app.llm_provider import describe_llm_provider, generate_llm_completion
from app.runtime_service import process_event_batch


def test_describe_llm_provider_uses_env(monkeypatch) -> None:
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "test-model")
    monkeypatch.setenv("LLM_BASE_URL", "http://llm.local/v1/")

    config = describe_llm_provider()

    assert config.configured is True
    assert config.model == "test-model"
    assert config.base_url == "http://llm.local/v1"


def test_generate_llm_completion_calls_openai_compatible_chat(monkeypatch) -> None:
    def fake_post_json(url: str, payload: dict, *, api_key: str, timeout: float) -> dict:
        assert url == "http://llm.local/v1/chat/completions"
        assert payload["model"] == "cost-model"
        assert payload["messages"][0]["role"] == "user"
        assert api_key == "secret"
        assert timeout == 2
        return {
            "choices": [{"message": {"content": "建议套用人工挖土方定额。"}}],
            "usage": {"total_tokens": 12},
        }

    monkeypatch.setattr(llm_provider, "_post_json", fake_post_json)

    result = generate_llm_completion(
        {
            "baseUrl": "http://llm.local/v1",
            "apiKey": "secret",
            "model": "cost-model",
            "messages": [{"role": "user", "content": "土方清单怎么套定额？"}],
            "timeoutSeconds": 2,
        }
    )

    assert result["provider"]["configured"] is True
    assert result["content"] == "建议套用人工挖土方定额。"
    assert result["usage"] == {"total_tokens": 12}


def test_process_event_batch_routes_llm_chat(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.runtime_service.generate_llm_completion",
        lambda payload: {"content": "ok", "provider": {"configured": True}},
    )

    result = process_event_batch(
        {
            "task": "llm_chat",
            "source": "ai_recommendation",
            "messages": [{"role": "user", "content": "hello"}],
        }
    )

    assert result["source"] == "ai_recommendation"
    assert result["result"]["content"] == "ok"
