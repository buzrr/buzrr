"""The Nest billing client: reserve/release over HTTP, faked with MockTransport."""

import json

import httpx
import pytest

from buzrr_ai.billing import BillingClient, TokenReservation
from buzrr_ai.errors import BillingUnavailable, PlanLimitReached, Unauthorized

BEARER = "Bearer user-token"


def client_with(handler: httpx.MockTransport) -> BillingClient:
    return BillingClient("http://nest.test/", transport=handler)


async def test_reserve_forwards_the_callers_token_and_returns_the_reservation() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200, json={"reservationId": "res_1", "releaseToken": "secret", "remaining": 2}
        )

    reservation = await client_with(httpx.MockTransport(handle)).reserve(BEARER)

    assert reservation == TokenReservation(reservation_id="res_1", release_token="secret")
    assert str(seen[0].url) == "http://nest.test/api/billing/ai-tokens/reserve"
    assert seen[0].headers["authorization"] == BEARER
    assert json.loads(seen[0].content) == {"source": "rag"}


async def test_reserve_passes_plan_limit_fields_through() -> None:
    def handle(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            403,
            json={
                "message": "You've used all 3 free AI generations.",
                "code": "PLAN_LIMIT",
                "limit": "ai_tokens",
                "max": 3,
                "resetsAt": None,
                "statusCode": 403,
                "internal": "never forwarded",
            },
        )

    with pytest.raises(PlanLimitReached) as caught:
        await client_with(httpx.MockTransport(handle)).reserve(BEARER)

    assert caught.value.status_code == 403
    assert caught.value.detail == "You've used all 3 free AI generations."
    assert caught.value.extra == {
        "code": "PLAN_LIMIT",
        "limit": "ai_tokens",
        "max": 3,
        "resetsAt": None,
    }


async def test_reserve_maps_401_to_unauthorized() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(401, json={"message": "no"}))
    with pytest.raises(Unauthorized):
        await client_with(transport).reserve(BEARER)


@pytest.mark.parametrize("status", [403, 500, 503])
async def test_reserve_fails_closed_on_other_errors(status: int) -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(status, json={"message": "x"}))
    with pytest.raises(BillingUnavailable):
        await client_with(transport).reserve(BEARER)


async def test_reserve_fails_closed_when_nest_is_unreachable() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(BillingUnavailable):
        await client_with(httpx.MockTransport(handle)).reserve(BEARER)


async def test_release_sends_the_release_token() -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"refunded": True})

    await client_with(httpx.MockTransport(handle)).release(
        BEARER, TokenReservation(reservation_id="res_1", release_token="secret")
    )

    assert str(seen[0].url) == "http://nest.test/api/billing/ai-tokens/release"
    assert json.loads(seen[0].content) == {"reservationId": "res_1", "releaseToken": "secret"}


async def test_release_never_raises() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    await client_with(httpx.MockTransport(handle)).release(
        BEARER, TokenReservation(reservation_id="res_1", release_token="secret")
    )
