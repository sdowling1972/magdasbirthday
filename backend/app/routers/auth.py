from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.invite_codes import CODE_LENGTH, format_invite_code, normalize_invite_code
from app.rate_limit import client_ip, limiter
from app.schemas import InvitePublic, PartyInfo
from app.services import get_invite_by_token
from app.sessions import clear_guest_session, set_guest_session

router = APIRouter(prefix="/api/auth", tags=["auth"])


class CodeLogin(BaseModel):
    code: str = Field(min_length=1, max_length=32)


class AuthOut(BaseModel):
    code: str
    formatted_code: str
    invite: InvitePublic


@router.post("/login", response_model=AuthOut)
def login_with_code(
    payload: CodeLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthOut:
    limiter.hit(f"guest-login:{client_ip(request)}", limit=20, window_seconds=60)
    code = normalize_invite_code(payload.code)
    if len(code) != CODE_LENGTH:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid invite code")
    invite = get_invite_by_token(db, code)
    if not invite:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid invite code")
    set_guest_session(response, invite.token)
    return AuthOut(
        code=invite.token,
        formatted_code=format_invite_code(invite.token),
        invite=InvitePublic(
            household_name=invite.household_name,
            max_guests=invite.max_guests,
            guests=invite.guests,
            party=PartyInfo(
                name=settings.party_name,
                date=settings.party_date,
                location=settings.party_location,
                description=settings.party_description,
            ),
        ),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout_guest(response: Response) -> None:
    clear_guest_session(response)
