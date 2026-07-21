"""In-memory rate limiting for auth endpoints (per process)."""

from __future__ import annotations

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def hit(self, key: str, *, limit: int, window_seconds: float) -> None:
        now = time.monotonic()
        with self._lock:
            recent = [t for t in self._hits[key] if now - t < window_seconds]
            if len(recent) >= limit:
                self._hits[key] = recent
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait and try again.",
                )
            recent.append(now)
            self._hits[key] = recent


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client:
        return request.client.host
    return "unknown"
