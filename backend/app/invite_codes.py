import secrets
import string

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.sessions import GUEST_COOKIE, decode_guest_session_token

CODE_LENGTH = 16
CODE_ALPHABET = string.ascii_uppercase


def generate_invite_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


def normalize_invite_code(raw: str) -> str:
    """Strip separators/spaces and uppercase; keep A–Z only."""
    return "".join(ch for ch in raw.upper() if "A" <= ch <= "Z")


def format_invite_code(code: str) -> str:
    cleaned = normalize_invite_code(code)
    return "-".join(cleaned[i : i + 4] for i in range(0, len(cleaned), 4))


def resolve_invite_code(request: Request) -> str | None:
    """Read invite code from the HttpOnly guest session cookie only."""
    cookie = request.cookies.get(GUEST_COOKIE)
    if not cookie:
        return None
    code = decode_guest_session_token(cookie)
    if not code:
        return None
    return normalize_invite_code(code)


def require_invite_code(
    request: Request,
    db: Session = Depends(get_db),
):
    from app.services import get_invite_by_token

    code = resolve_invite_code(request)
    if not code:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required")
    if len(code) != CODE_LENGTH:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    invite = get_invite_by_token(db, code)
    if not invite:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return invite
