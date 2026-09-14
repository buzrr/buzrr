"""Error envelope.

The Nest server's `AllExceptionsFilter` emits `{ message, statusCode, ... }` and
the web client's `getApiErrorMessage` (apps/web/src/lib/api/errors.ts) reads
exactly that shape. Matching it means the AI service needs zero special-casing
on the frontend.
"""

from typing import Any

import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

log = structlog.get_logger(__name__)


def _envelope(status: int, message: str | list[str], **extra: Any) -> JSONResponse:
    body: dict[str, Any] = {"message": message, "statusCode": status, **extra}
    return JSONResponse(status_code=status, content=body)


class AppError(HTTPException):
    """Base for errors we raise deliberately."""


class NotFound(AppError):
    """404.

    Also used for "you do not own this" — the Nest services deliberately return
    `NotFoundException("Unauthorized or quiz not found")` so ownership never
    leaks through a 403/404 distinction. Same reasoning here.
    """

    def __init__(self, message: str = "Not found") -> None:
        super().__init__(status_code=404, detail=message)


class BadRequest(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(status_code=400, detail=message)


class Unauthorized(AppError):
    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(status_code=401, detail=message)


class TooManyRequests(AppError):
    def __init__(self, message: str = "Rate limit reached, wait a while and try again.") -> None:
        super().__init__(status_code=429, detail=message)


class PlanLimitReached(AppError):
    """403 — the account's AI generation allowance is spent.

    Carries Nest's `PLAN_LIMIT` fields (`code`, `limit`, `max`, `resetsAt`) through
    unchanged so the web client shows the same upgrade prompt for both services.
    """

    def __init__(self, message: str, extra: dict[str, Any]) -> None:
        super().__init__(status_code=403, detail=message)
        self.extra = extra


class BillingUnavailable(AppError):
    """503 — the Nest billing ledger couldn't be reached, so generation fails closed."""

    def __init__(
        self,
        message: str = "Couldn't check your AI generation allowance. Please try again shortly.",
    ) -> None:
        super().__init__(status_code=503, detail=message)


class UpstreamError(AppError):
    """502 — the model provider failed."""

    def __init__(self, message: str = "The AI service failed. Please try again later.") -> None:
        super().__init__(status_code=502, detail=message)


class UpstreamRateLimited(AppError):
    """429 — the *provider's* quota, not ours.

    Distinct from `TooManyRequests` (our own per-user limiter) because the two
    need different words: the user did nothing wrong here and the only useful
    advice is to wait. Ingestion also treats it differently — a quota blip means
    requeue the document, not blame it.
    """

    def __init__(
        self,
        message: str = (
            "The AI provider's rate limit was reached. This usually clears in a "
            "minute or two — try again shortly."
        ),
    ) -> None:
        super().__init__(status_code=429, detail=message)


class UpstreamTimeout(AppError):
    """503 — mirrors the Nest AI route's timeout mapping."""

    def __init__(
        self,
        message: str = "The AI service took too long to respond. Please try again.",
    ) -> None:
        super().__init__(status_code=503, detail=message)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def _http(_: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str | list) else str(exc.detail)
        extra = exc.extra if isinstance(exc, PlanLimitReached) else {}
        return _envelope(exc.status_code, detail, **extra)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        # class-validator on the Nest side returns `message` as a string array;
        # match that so `getApiErrorMessage` joins them the same way.
        messages = [
            f"{'.'.join(str(p) for p in e['loc'] if p != 'body')}: {e['msg']}".lstrip(": ")
            for e in exc.errors()
        ]
        return _envelope(400, messages)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", path=request.url.path, error=str(exc))
        return _envelope(500, "Internal server error")
