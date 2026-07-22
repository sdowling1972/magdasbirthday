"""In-process once-per-guest-session notification gates."""

from __future__ import annotations

import hashlib
import threading

from fastapi import Request

from app.sessions import GUEST_COOKIE

_lock = threading.Lock()
_sent: set[str] = set()
_MAX_KEYS = 5000


def _session_fingerprint(request: Request) -> str:
    cookie = request.cookies.get(GUEST_COOKIE) or ""
    if cookie:
        return hashlib.sha256(cookie.encode("utf-8")).hexdigest()[:32]
    # Rare fallback when cookie auth isn't present
    client = request.client.host if request.client else "unknown"
    return hashlib.sha256(f"ip:{client}".encode("utf-8")).hexdigest()[:32]


def claim_notification(request: Request, kind: str) -> bool:
    """
    Return True the first time this guest session claims `kind`
    (e.g. 'rsvp' or 'photo'); False on later claims in the same session.
    """
    key = f"{kind}:{_session_fingerprint(request)}"
    with _lock:
        if key in _sent:
            return False
        if len(_sent) >= _MAX_KEYS:
            _sent.clear()
        _sent.add(key)
        return True
