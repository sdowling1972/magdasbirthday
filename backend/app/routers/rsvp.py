from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.invite_codes import require_invite_code
from app.models import Invite, RsvpStatus
from app.notifications import notify_rsvp_update
from app.schemas import InvitePublic, PartyInfo

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
    background_tasks: BackgroundTasks,
    invite: Invite = Depends(require_invite_code),
    db: Session = Depends(get_db),
) -> InvitePublic:
    guest_map = {g.id: g for g in invite.guests}
    now = datetime.now(timezone.utc)

    # Snapshot plain values BEFORE mutating ORM objects.
    before_email = None if invite.email is None else str(invite.email)
    before_comments = None if invite.general_comments is None else str(invite.general_comments)
    before_guests = [
        {
            "id": str(g.id),
            "name": str(g.name),
            "rsvp_status": str(g.rsvp_status.value),
            "message": None if g.message is None else str(g.message),
        }
        for g in invite.guests
    ]

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
    if "general_comments" in payload.model_fields_set:
        invite.general_comments = payload.general_comments

    db.commit()
    db.refresh(invite)
    for guest in invite.guests:
        db.refresh(guest)

    after_email = None if invite.email is None else str(invite.email)
    after_comments = None if invite.general_comments is None else str(invite.general_comments)
    after_guests = [
        {
            "id": str(g.id),
            "name": str(g.name),
            "rsvp_status": str(g.rsvp_status.value),
            "message": None if g.message is None else str(g.message),
        }
        for g in sorted(invite.guests, key=lambda g: (g.sort_order, g.name))
    ]

    # Guests only hit this endpoint on explicit save — email reflects that full update.
    background_tasks.add_task(
        notify_rsvp_update,
        household_name=str(invite.household_name),
        invite_id=str(invite.id),
        before_email=before_email,
        after_email=after_email,
        before_comments=before_comments,
        after_comments=after_comments,
        before_guests=before_guests,
        after_guests=after_guests,
    )
    return _public_invite(invite)
