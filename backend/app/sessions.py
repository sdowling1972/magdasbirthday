"""HttpOnly cookie sessions for guests and admin (works with <img> requests)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Response
from jose import JWTError, jwt

from app.config import settings

GUEST_COOKIE = "magda_guest"
ADMIN_COOKIE = "magda_admin"


def _cookie_kwargs() -> dict:
    return {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": "lax",
        "path": "/",
        "max_age": settings.access_token_expire_minutes * 60,
    }


def create_guest_session_token(invite_code: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": "guest", "code": invite_code, "exp": expire},
        settings.secret_key,
        algorithm="HS256",
    )


def decode_guest_session_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError:
        return None
    if payload.get("sub") != "guest":
        return None
    code = payload.get("code")
    return code if isinstance(code, str) else None


def set_guest_session(response: Response, invite_code: str) -> None:
    response.set_cookie(GUEST_COOKIE, create_guest_session_token(invite_code), **_cookie_kwargs())


def clear_guest_session(response: Response) -> None:
    response.delete_cookie(GUEST_COOKIE, path="/")


def set_admin_session(response: Response, access_token: str) -> None:
    response.set_cookie(ADMIN_COOKIE, access_token, **_cookie_kwargs())


def clear_admin_session(response: Response) -> None:
    response.delete_cookie(ADMIN_COOKIE, path="/")
