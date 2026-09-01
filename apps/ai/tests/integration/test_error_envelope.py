"""The error envelope must match Nest's so `getApiErrorMessage` works unchanged."""

import pytest

from tests.integration.conftest import auth

pytestmark = pytest.mark.asyncio


async def test_error_body_has_message_and_status_code(client) -> None:  # type: ignore[no-untyped-def]
    body = (await client.get("/api/ai/spaces")).json()
    assert set(body) >= {"message", "statusCode"}
    assert body["statusCode"] == 401


async def test_validation_errors_come_back_as_a_string_array(client, alice_token) -> None:  # type: ignore[no-untyped-def]
    # class-validator on the Nest side returns an array; the web client joins it.
    response = await client.post("/api/ai/spaces", json={"name": ""}, headers=auth(alice_token))
    assert response.status_code == 400
    assert isinstance(response.json()["message"], list)


async def test_health_reports_per_dependency_status(client) -> None:  # type: ignore[no-untyped-def]
    response = await client.get("/health")
    body = response.json()
    assert set(body) == {"status", "uptime", "timestamp", "services"}
    assert set(body["services"]) == {"database", "redis"}
