"""The OpenAI-compatible provider (Ollama, vLLM, …), against a mock transport."""

import json
import math
from typing import Any

import httpx
import pytest
from pydantic import BaseModel, ValidationError

from buzrr_ai.config import Settings, get_settings
from buzrr_ai.errors import UpstreamError, UpstreamRateLimited
from buzrr_ai.providers.openai_compat import OpenAICompatEmbeddings, OpenAICompatLLM


def _settings(**overrides: Any) -> Settings:
    base = get_settings().model_dump()
    base.update(
        llm_provider="openai",
        llm_base_url="http://ollama.test/v1",
        ai_generation_model="llama3.1",
        ai_embedding_model="nomic-embed-text",
        ai_embed_requests_per_minute=10_000,
    )
    base.update(overrides)
    return Settings(**base)


class Answer(BaseModel):
    question: str
    options: list[str]


def _transport(handler: Any) -> httpx.MockTransport:
    return httpx.MockTransport(handler)


async def test_structured_output_posts_a_json_schema_chat_completion() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers.get("authorization")
        seen["body"] = json.loads(request.content)
        content = '```json\n{"question": "2+2?", "options": ["4", "5"]}\n```'
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    llm = OpenAICompatLLM(_settings(), transport=_transport(handler))
    result = await llm.structured(system="sys", prompt="make one", schema=Answer)

    assert result == Answer(question="2+2?", options=["4", "5"])
    assert seen["url"] == "http://ollama.test/v1/chat/completions"
    # No key configured → no auth header (what Ollama expects).
    assert seen["auth"] is None
    assert seen["body"]["model"] == "llama3.1"
    assert seen["body"]["response_format"]["type"] == "json_schema"
    assert "JSON Schema" in seen["body"]["messages"][0]["content"]


async def test_an_api_key_is_sent_as_a_bearer_token() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == "Bearer sk-test"
        body = {"choices": [{"message": {"content": '{"question": "q", "options": []}'}}]}
        return httpx.Response(200, json=body)

    llm = OpenAICompatLLM(_settings(llm_api_key="sk-test"), transport=_transport(handler))
    await llm.structured(system="s", prompt="p", schema=Answer)


async def test_an_unusable_answer_is_a_clean_upstream_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": "sorry!"}}]})

    llm = OpenAICompatLLM(_settings(), transport=_transport(handler))
    with pytest.raises(UpstreamError):
        await llm.structured(system="s", prompt="p", schema=Answer)


async def test_embeddings_are_ordered_and_normalised() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert body["dimensions"] == 768
        data = [
            {"index": i, "embedding": [float(i + 1)] + [0.0] * 767}
            for i in range(len(body["input"]))
        ]
        return httpx.Response(200, json={"data": list(reversed(data))})

    emb = OpenAICompatEmbeddings(_settings(), transport=_transport(handler))
    vectors = await emb.embed_documents(["a", "b"])
    assert len(vectors) == 2
    assert all(len(v) == 768 for v in vectors)
    assert math.isclose(math.sqrt(sum(x * x for x in vectors[0])), 1.0)


async def test_a_model_of_the_wrong_width_is_explained_not_stored() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": [{"index": 0, "embedding": [0.1] * 384}]})

    emb = OpenAICompatEmbeddings(_settings(), transport=_transport(handler))
    with pytest.raises(UpstreamError, match="384 dimensions"):
        await emb.embed_query("hello")


async def test_rate_limits_retry_then_surface_as_429(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(429, text="rate limit", headers={"retry-after": "0"})

    # Don't actually wait out the backoff.
    import buzrr_ai.providers._resilience as resilience

    monkeypatch.setattr(resilience, "_wait", lambda max_wait: lambda state: 0.0)
    from buzrr_ai.providers import openai_compat

    monkeypatch.setattr(
        openai_compat,
        "_retry_interactive",
        resilience._retrying(attempts=3, max_wait=0, deadline=5),
    )
    emb = OpenAICompatEmbeddings(_settings(), transport=_transport(handler))
    with pytest.raises(UpstreamRateLimited):
        await emb.embed_query("hello")
    assert calls == 3


def test_provider_defaults_keep_existing_gemini_installs() -> None:
    assert _settings(llm_provider=None, llm_base_url="").provider == "gemini"
    assert _settings(llm_provider=None).provider == "openai"


def test_settings_fail_at_boot_without_a_usable_provider() -> None:
    with pytest.raises(ValidationError, match="GEMINI_API_KEY"):
        _settings(llm_provider="gemini", gemini_api_key="")
    with pytest.raises(ValidationError, match="LLM_BASE_URL"):
        _settings(llm_provider="openai", llm_base_url="")
