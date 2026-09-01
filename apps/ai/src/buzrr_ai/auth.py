"""JWT verification.

No new identity and no new secret: this service verifies exactly the token the
Nest server verifies (`apps/server/src/modules/auth/jwt.strategy.ts`) — HS256
signed with the shared `BETTER_AUTH_SECRET`, claims `{sub, email?, typ?}`.

Invariant #12 (docs/architecture/invariants.md): one shared secret, two token
types, and only the `typ` claim separates them. Guest player tokens must never
be accepted where an account is required — Knowledge Spaces are account-scoped,
so `typ == "player"` is rejected outright.
"""

from dataclasses import dataclass
from typing import Annotated, Any

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from buzrr_ai.config import get_settings
from buzrr_ai.errors import Unauthorized

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class AuthUser:
    user_id: str
    email: str | None = None


def _decode(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        decoded: dict[str, Any] = jwt.decode(
            token,
            settings.better_auth_secret,
            algorithms=["HS256"],
        )
        return decoded
    except jwt.PyJWTError as exc:
        raise Unauthorized() from exc


def current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AuthUser:
    if creds is None or not creds.credentials:
        raise Unauthorized()

    payload = _decode(creds.credentials)

    if payload.get("typ") == "player":
        # An anonymous classic-mode guest. Never an account.
        raise Unauthorized()

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise Unauthorized()

    email = payload.get("email")
    return AuthUser(user_id=subject, email=email if isinstance(email, str) else None)


CurrentUser = Annotated[AuthUser, Depends(current_user)]
