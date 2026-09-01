"""Per-user sliding-window limits on the two expensive routes.

The Nest server rate-limits per **IP** over Upstash REST
(`common/services/rate-limit.service.ts`). Here the key is the **user**, because
embedding and generation cost is attributable to an account, not a network path
— and a shared campus NAT shouldn't make one student's upload exhaust everyone's
budget.
"""

import time

from arq.connections import ArqRedis

from buzrr_ai.errors import TooManyRequests


async def enforce(
    redis: ArqRedis, *, user_id: str, action: str, limit: int, window_seconds: int
) -> None:
    key = f"ai:rl:{action}:{user_id}"
    now = time.time()
    cutoff = now - window_seconds

    async with redis.pipeline(transaction=True) as pipe:
        pipe.zremrangebyscore(key, 0, cutoff)
        pipe.zcard(key)
        pipe.zadd(key, {f"{now}": now})
        pipe.expire(key, window_seconds)
        _, used, _, _ = await pipe.execute()

    if int(used) >= limit:
        raise TooManyRequests(
            f"You've hit the limit of {limit} {action} per hour. Try again later."
        )
