from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.invite_codes import require_invite_code
from app.models import Invite, RsvpStatus
from app.schemas import GuestOut, InvitePublic, PartyInfo

router = APIRouter(prefix="/api/rsvp", tags=["rsvp"])


class GuestRsvpItem(BaseModel):
    guest_id: UUID
    rsvp_status: RsvpStatus
    dietary_notes: str | None = None
    message: str | None = None


class RsvpPayload(BaseModel):
    guests: list[GuestRsvpItem] = Field(min_length=1)
    email: EmailStr | None = None
    general_comments: str | None = None

    @field_validator("email", mode="before")
    @classmethod
    def blank_email_to_none(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("general_comments", mode="before")
    @classmethod
    def blank_comments_to_none(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return value


def _party() -> PartyInfo:
    return PartyInfo(
        name=settings.party_name,
        date=settings.party_date,
        location=settings.party_location,
        description=settings.party_description,
    )


def _public_invite(invite: Invite) -> InvitePublic:
    return InvitePublic(
        household_name=invite.household_name,
        email=invite.email,
        general_comments=invite.general_comments,
        max_guests=invite.max_guests,
        guests=invite.guests,
        party=_party(),
    )


@router.get("", response_model=InvitePublic)
def get_rsvp(invite: Invite = Depends(require_invite_code)) -> InvitePublic:
    return _public_invite(invite)


@router.put("", response_model=InvitePublic)
def submit_rsvp(
    payload: RsvpPayload,
    invite: Invite = Depends(require_invite_code),
    db: Session = Depends(get_db),
) -> InvitePublic:
    guest_map = {g.id: g for g in invite.guests}
    now = datetime.now(timezone.utc)

    for item in payload.guests:
        guest = guest_map.get(item.guest_id)
        if not guest:
            raise HTTPException(status_code=400, detail=f"Guest {item.guest_id} not on this invite")
        if item.rsvp_status == RsvpStatus.pending:
            raise HTTPException(status_code=400, detail="Please choose attending or declined for each guest")
        guest.rsvp_status = item.rsvp_status
        guest.dietary_notes = item.dietary_notes
        guest.message = item.message
        guest.rsvp_at = now

    if payload.email is not None:
        invite.email = str(payload.email)
    # Always allow clearing or setting general comments when provided in payload
    if "general_comments" in payload.model_fields_set:
        invite.general_comments = payload.general_comments

    db.commit()
    db.refresh(invite)
    return _public_invite(invite)
