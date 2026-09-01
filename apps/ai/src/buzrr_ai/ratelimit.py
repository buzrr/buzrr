"""Per-user sliding-window limits on the two expensive routes.

The Nest server rate-limits per **IP** over Upstash REST
(`common/services/rate-limit.service.ts`). Here the key is the **user**, because
embedding and generation cost is attributable to an account, not a network path
— and a shared campus NAT shouldn't make one student's upload exhaust everyone's
budget.
"""

import time
import uuid

from arq.connections import ArqRedis

from buzrr_ai.errors import TooManyRequests


def _window_label(seconds: int) -> str:
    """Human wording for the caller-supplied window — never a hardcoded unit."""
    if seconds % 3600 == 0:
        hours = seconds // 3600
        return "hour" if hours == 1 else f"{hours} hours"
    if seconds % 60 == 0:
        minutes = seconds // 60
        return "minute" if minutes == 1 else f"{minutes} minutes"
    return f"{seconds} seconds"


async def enforce(
    redis: ArqRedis, *, user_id: str, action: str, limit: int, window_seconds: int
) -> None:
    key = f"ai:rl:{action}:{user_id}"
    now = time.time()
    cutoff = now - window_seconds

    async with redis.pipeline(transaction=True) as pipe:
        pipe.zremrangebyscore(key, 0, cutoff)
        pipe.zcard(key)
        _, used = await pipe.execute()

    if int(used) >= limit:
        # Deliberately no write here: recording a rejected request would keep
        # refreshing the newest entry, so a client in a retry loop could never
        # drain the window and the limit would become an indefinite lockout.
        raise TooManyRequests(
            f"You've hit the limit of {limit} {action} per "
            f"{_window_label(window_seconds)}. Try again later."
        )

    async with redis.pipeline(transaction=True) as pipe:
        # The member must be unique: two requests inside the same `time.time()`
        # tick would otherwise update one score instead of counting twice.
        pipe.zadd(key, {f"{now}:{uuid.uuid4().hex}": now})
        pipe.expire(key, window_seconds)
        await pipe.execute()
