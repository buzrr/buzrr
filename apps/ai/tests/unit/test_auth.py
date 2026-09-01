"""JWT verification.

The `typ: "player"` rejection is the one that matters: invariant #12 says a
player token must never be accepted where an account is required, and Knowledge
Spaces are account-scoped.
"""

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from buzrr_ai.auth import current_user
from buzrr_ai.errors import Unauthorized
from tests.conftest import make_token


def _creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_accepts_an_account_token() -> None:
    user = current_user(_creds(make_token("user_alice", email="alice@example.com")))
    assert user.user_id == "user_alice"
    assert user.email == "alice@example.com"


def test_accepts_a_token_without_email() -> None:
    assert current_user(_creds(make_token("user_bob", email=None))).email is None


def test_rejects_a_player_token() -> None:
    with pytest.raises(Unauthorized):
        current_user(_creds(make_token("player_1", email=None, typ="player")))


def test_rejects_a_token_signed_with_another_secret() -> None:
    with pytest.raises(Unauthorized):
        current_user(_creds(make_token("user_alice", secret="a-different-secret")))


def test_rejects_an_expired_token() -> None:
    with pytest.raises(Unauthorized):
        current_user(_creds(make_token("user_alice", expires_in=-60)))


def test_rejects_a_token_with_no_subject() -> None:
    import jwt

    from tests.conftest import SECRET

    token = jwt.encode({"email": "x@y.z"}, SECRET, algorithm="HS256")
    with pytest.raises(Unauthorized):
        current_user(_creds(token))


def test_rejects_missing_credentials() -> None:
    with pytest.raises(Unauthorized):
        current_user(None)


def test_rejects_garbage() -> None:
    with pytest.raises(Unauthorized):
        current_user(_creds("not-a-jwt"))
