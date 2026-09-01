"""Tenant isolation.

The single most important property in this service: a knowledge space is
private to the account that created it. Every endpoint that takes an id must
answer 404 for anyone else — not 403, which would confirm the resource exists.
"""

import pytest

from tests.integration.conftest import auth, new_id

pytestmark = pytest.mark.asyncio


async def _make_space(client, token, name="Alice's notes"):  # type: ignore[no-untyped-def]
    response = await client.post("/api/ai/spaces", json={"name": name}, headers=auth(token))
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def test_unauthenticated_requests_are_rejected(client) -> None:  # type: ignore[no-untyped-def]
    assert (await client.get("/api/ai/spaces")).status_code == 401


async def test_player_tokens_are_rejected(client, player_token) -> None:  # type: ignore[no-untyped-def]
    response = await client.get("/api/ai/spaces", headers=auth(player_token))
    assert response.status_code == 401


async def test_a_user_only_sees_their_own_spaces(client, alice_token, bob_token) -> None:  # type: ignore[no-untyped-def]
    await _make_space(client, alice_token, "Alice A")
    await _make_space(client, bob_token, "Bob B")

    alice = await client.get("/api/ai/spaces", headers=auth(alice_token))
    names = [s["name"] for s in alice.json()]
    assert "Alice A" in names
    assert "Bob B" not in names


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/ai/spaces/{id}"),
        ("PATCH", "/api/ai/spaces/{id}"),
        ("DELETE", "/api/ai/spaces/{id}"),
        ("GET", "/api/ai/spaces/{id}/documents"),
        ("GET", "/api/ai/spaces/{id}/status"),
        ("GET", "/api/ai/spaces/{id}/runs"),
    ],
)
async def test_another_user_gets_404_on_every_space_route(  # type: ignore[no-untyped-def]
    client, alice_token, bob_token, method, path
) -> None:
    space_id = await _make_space(client, alice_token, f"space-{method}-{path}")
    url = path.format(id=space_id)

    response = await client.request(
        method, url, headers=auth(bob_token), json={} if method == "PATCH" else None
    )
    assert response.status_code == 404, f"{method} {url} leaked: {response.status_code}"
    assert "Unauthorized or" in response.json()["message"]


async def test_generate_on_another_users_space_is_404(client, alice_token, bob_token) -> None:  # type: ignore[no-untyped-def]
    space_id = await _make_space(client, alice_token, "private")
    response = await client.post(
        f"/api/ai/spaces/{space_id}/generate",
        json={"prompt": "make some questions"},
        headers=auth(bob_token),
    )
    assert response.status_code == 404


async def test_unknown_ids_are_404_not_500(client, alice_token) -> None:  # type: ignore[no-untyped-def]
    assert (
        await client.get(f"/api/ai/spaces/{new_id()}", headers=auth(alice_token))
    ).status_code == 404
    assert (
        await client.get(f"/api/ai/runs/{new_id()}", headers=auth(alice_token))
    ).status_code == 404
    assert (
        await client.delete(f"/api/ai/documents/{new_id()}", headers=auth(alice_token))
    ).status_code == 404


async def test_duplicate_space_name_is_rejected_per_user(client, alice_token, bob_token) -> None:  # type: ignore[no-untyped-def]
    await _make_space(client, alice_token, "Shared Name")
    dupe = await client.post(
        "/api/ai/spaces", json={"name": "Shared Name"}, headers=auth(alice_token)
    )
    assert dupe.status_code == 400

    # ...but the name is only unique per user, so Bob can reuse it.
    ok = await client.post("/api/ai/spaces", json={"name": "Shared Name"}, headers=auth(bob_token))
    assert ok.status_code == 201
