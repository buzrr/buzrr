"""Generation spends a plan token through Nest, and gives it back on failure."""

from httpx import AsyncClient

from tests.integration.conftest import FakeBilling, auth


async def _create_space(client: AsyncClient, token: str) -> str:
    res = await client.post("/api/ai/spaces", json={"name": "Physics"}, headers=auth(token))
    assert res.status_code in (200, 201), res.text
    return str(res.json()["id"])


async def test_failed_generation_refunds_the_token(
    client: AsyncClient, fake_billing: FakeBilling, alice_token: str
) -> None:
    space_id = await _create_space(client, alice_token)

    # An empty space can't be generated from — the request fails after reserving.
    res = await client.post(
        f"/api/ai/spaces/{space_id}/generate",
        json={"prompt": "Newton's laws"},
        headers=auth(alice_token),
    )

    assert res.status_code == 400
    assert fake_billing.reserved == ["res_1"]
    assert fake_billing.released == ["res_1"]


async def test_exhausted_allowance_returns_the_plan_limit_envelope(
    client: AsyncClient, fake_billing: FakeBilling, alice_token: str
) -> None:
    space_id = await _create_space(client, alice_token)
    fake_billing.limit_reached = True

    res = await client.post(
        f"/api/ai/spaces/{space_id}/generate",
        json={"prompt": "Newton's laws"},
        headers=auth(alice_token),
    )

    assert res.status_code == 403
    assert res.json() == {
        "message": "You've used all 3 free AI generations.",
        "statusCode": 403,
        "code": "PLAN_LIMIT",
        "limit": "ai_tokens",
        "max": 3,
        "resetsAt": None,
    }
    assert fake_billing.released == []
