from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import RsvpStatus
from app.schemas import GuestOut, InvitePublic, PartyInfo
from app.services import get_invite_by_token

router = APIRouter(prefix="/api/rsvp", tags=["rsvp"])


class GuestRsvpItem(BaseModel):
    guest_id: UUID
    rsvp_status: RsvpStatus
    dietary_notes: str | None = None
    message: str | None = None


class RsvpPayload(BaseModel):
    guests: list[GuestRsvpItem] = Field(min_length=1)


@router.get("/{token}", response_model=InvitePublic)
def get_rsvp_page(token: str, db: Session = Depends(get_db)) -> InvitePublic:
    invite = get_invite_by_token(db, token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    return InvitePublic(
        household_name=invite.household_name,
        max_guests=invite.max_guests,
        guests=invite.guests,
        party=PartyInfo(
            name=settings.party_name,
            date=settings.party_date,
            location=settings.party_location,
            description=settings.party_description,
        ),
    )


@router.put("/{token}", response_model=list[GuestOut])
def submit_rsvp(token: str, payload: RsvpPayload, db: Session = Depends(get_db)) -> list[GuestOut]:
    invite = get_invite_by_token(db, token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

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
    invite = get_invite_by_token(db, token)
    assert invite is not None
    return invite.guests
