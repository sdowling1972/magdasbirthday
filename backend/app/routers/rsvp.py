from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
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


def _party() -> PartyInfo:
    return PartyInfo(
        name=settings.party_name,
        date=settings.party_date,
        location=settings.party_location,
        description=settings.party_description,
    )


@router.get("", response_model=InvitePublic)
def get_rsvp(invite: Invite = Depends(require_invite_code)) -> InvitePublic:
    return InvitePublic(
        household_name=invite.household_name,
        max_guests=invite.max_guests,
        guests=invite.guests,
        party=_party(),
    )


@router.put("", response_model=list[GuestOut])
def submit_rsvp(
    payload: RsvpPayload,
    invite: Invite = Depends(require_invite_code),
    db: Session = Depends(get_db),
) -> list[GuestOut]:
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

    db.commit()
    db.refresh(invite)
    return invite.guests
