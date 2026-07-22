"""HttpOnly cookie sessions for guests and admin (works with <img> requests)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Response
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response as StarletteResponse
from starlette.types import ASGIApp

from app.config import settings

GUEST_COOKIE = "magda_guest"
ADMIN_COOKIE = "magda_admin"
ALGORITHM = "HS256"


def _cookie_kwargs() -> dict:
    return {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": "lax",
        "path": "/",
        "max_age": settings.access_token_expire_minutes * 60,
    }


def _delete_kwargs() -> dict:
    """Must match set_cookie attributes or browsers keep the cookie."""
    return {
        "path": "/",
        "secure": settings.cookie_secure,
        "httponly": True,
        "samesite": "lax",
    }


def create_guest_session_token(invite_code: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": "guest", "code": invite_code, "exp": expire},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


def decode_guest_session_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if payload.get("sub") != "guest":
        return None
    code = payload.get("code")
    return code if isinstance(code, str) else None


def admin_session_valid(token: str) -> bool:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload.get("sub") == "admin"
    except JWTError:
        return False


def set_guest_session(response: Response, invite_code: str) -> None:
    response.set_cookie(GUEST_COOKIE, create_guest_session_token(invite_code), **_cookie_kwargs())


def clear_guest_session(response: Response) -> None:
    response.delete_cookie(GUEST_COOKIE, **_delete_kwargs())


def set_admin_session(response: Response, access_token: str) -> None:
    response.set_cookie(ADMIN_COOKIE, access_token, **_cookie_kwargs())


def clear_admin_session(response: Response) -> None:
    response.delete_cookie(ADMIN_COOKIE, **_delete_kwargs())


class SessionCookieCleanupMiddleware(BaseHTTPMiddleware):
    """Drop expired/invalid login cookies, and clear them on auth failures."""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> StarletteResponse:
        response = await call_next(request)
        path = request.url.path

        guest_cookie = request.cookies.get(GUEST_COOKIE)
        admin_cookie = request.cookies.get(ADMIN_COOKIE)

        guest_invalid = bool(guest_cookie) and decode_guest_session_token(guest_cookie) is None
        admin_invalid = bool(admin_cookie) and not admin_session_valid(admin_cookie)

        if guest_invalid:
            clear_guest_session(response)
        if admin_invalid:
            clear_admin_session(response)

        if response.status_code == 401:
            # Failed guest login / protected guest routes — never leave a stale guest session.
            if path.startswith("/api/auth/login") or path.startswith(
                ("/api/party", "/api/rsvp", "/api/photos")
            ):
                clear_guest_session(response)
            elif path == "/api/auth/session":
                clear_guest_session(response)
            # Failed admin auth — clear admin session cookie.
            if path.startswith("/api/admin"):
                clear_admin_session(response)

        return response
