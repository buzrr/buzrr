"""AI-generation token accounting, delegated to the Nest server.

The token ledger lives in `public` and this service never writes there
(invariant #31), so every generation reserves a token through Nest's
`POST /api/billing/ai-tokens/reserve` — authenticated with the caller's own
bearer token, so no new service credential exists (invariant #32). A failed
generation refunds through `/release` with the reservation's release token,
which never leaves this process.
"""

from dataclasses import dataclass
from typing import Any

import httpx
import structlog

from buzrr_ai.errors import BillingUnavailable, PlanLimitReached, Unauthorized

log = structlog.get_logger(__name__)

_TIMEOUT = httpx.Timeout(10.0)
# Fields of Nest's PLAN_LIMIT body the web client reads; nothing else passes.
_PLAN_LIMIT_FIELDS = ("code", "limit", "max", "resetsAt")


@dataclass(frozen=True, slots=True)
class TokenReservation:
    reservation_id: str
    release_token: str


class BillingClient:
    def __init__(self, api_url: str, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._base = api_url.rstrip("/") + "/api/billing/ai-tokens"
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=_TIMEOUT, transport=self._transport)

    async def reserve(self, authorization: str) -> TokenReservation:
        try:
            async with self._client() as client:
                res = await client.post(
                    f"{self._base}/reserve",
                    json={"source": "rag"},
                    headers={"Authorization": authorization},
                )
        except httpx.HTTPError as exc:
            # Fail closed: without the ledger we can't know the user has tokens left.
            log.warning("billing_reserve_unreachable", error=str(exc))
            raise BillingUnavailable() from exc

        if res.status_code == 200:
            body = res.json()
            return TokenReservation(
                reservation_id=str(body["reservationId"]),
                release_token=str(body["releaseToken"]),
            )

        body = _json_or_empty(res)
        if res.status_code == 403 and body.get("code") == "PLAN_LIMIT":
            message = body.get("message")
            raise PlanLimitReached(
                message if isinstance(message, str) else "AI generation limit reached",
                {key: body[key] for key in _PLAN_LIMIT_FIELDS if key in body},
            )
        if res.status_code == 401:
            raise Unauthorized()
        log.warning("billing_reserve_failed", status=res.status_code)
        raise BillingUnavailable()

    async def release(self, authorization: str, reservation: TokenReservation) -> None:
        """Best-effort refund. Never raises — the original failure is what matters."""
        try:
            async with self._client() as client:
                res = await client.post(
                    f"{self._base}/release",
                    json={
                        "reservationId": reservation.reservation_id,
                        "releaseToken": reservation.release_token,
                    },
                    headers={"Authorization": authorization},
                )
            if res.status_code != 200:
                log.warning(
                    "billing_release_failed",
                    status=res.status_code,
                    reservation_id=reservation.reservation_id,
                )
        except httpx.HTTPError as exc:
            log.warning(
                "billing_release_unreachable",
                error=str(exc),
                reservation_id=reservation.reservation_id,
            )


def _json_or_empty(res: httpx.Response) -> dict[str, Any]:
    try:
        body = res.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}
