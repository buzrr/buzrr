"""Test configuration.

Env vars are set before any `buzrr_ai` import so `Settings` (which fails loudly
on missing required values) can construct.
"""

import os

os.environ.setdefault("AI_DATABASE_URL", "postgresql://buzrr:buzrr@localhost:5432/buzrr")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("BETTER_AUTH_SECRET", "test-secret-not-used-in-production")
os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("AI_WEB_ORIGIN", "http://localhost:3000")

import time  # noqa: E402

import jwt  # noqa: E402
import pytest  # noqa: E402

SECRET = os.environ["BETTER_AUTH_SECRET"]


def make_token(
    subject: str = "user_alice",
    *,
    email: str | None = "alice@example.com",
    typ: str | None = None,
    expires_in: int = 3600,
    secret: str = SECRET,
) -> str:
    payload: dict[str, object] = {"sub": subject, "iat": int(time.time())}
    if email:
        payload["email"] = email
    if typ:
        payload["typ"] = typ
    if expires_in is not None:
        payload["exp"] = int(time.time()) + expires_in
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def alice_token() -> str:
    return make_token("user_alice", email="alice@example.com")


@pytest.fixture
def bob_token() -> str:
    return make_token("user_bob", email="bob@example.com")


@pytest.fixture
def player_token() -> str:
    """An anonymous classic-mode guest token, minted by the Nest server."""
    return make_token("player_123", email=None, typ="player")
