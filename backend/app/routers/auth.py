from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.invite_codes import CODE_LENGTH, format_invite_code, normalize_invite_code
from app.schemas import InvitePublic, PartyInfo
from app.services import get_invite_by_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class CodeLogin(BaseModel):
    code: str = Field(min_length=1, max_length=32)


class AuthOut(BaseModel):
    code: str
    formatted_code: str
    invite: InvitePublic


@router.post("/login", response_model=AuthOut)
def login_with_code(payload: CodeLogin, db: Session = Depends(get_db)) -> AuthOut:
    code = normalize_invite_code(payload.code)
    if len(code) != CODE_LENGTH:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid invite code")
    invite = get_invite_by_token(db, code)
    if not invite:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid invite code")
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
