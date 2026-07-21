import secrets
import string

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db

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


def require_invite_code(
    x_invite_code: str | None = Header(default=None, alias="X-Invite-Code"),
    db: Session = Depends(get_db),
):
    from app.services import get_invite_by_token

    if not x_invite_code:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invite code required")
    code = normalize_invite_code(x_invite_code)
    if len(code) != CODE_LENGTH:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid invite code")
    invite = get_invite_by_token(db, code)
    if not invite:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid invite code")
    return invite
