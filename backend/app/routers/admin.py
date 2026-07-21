from uuid import UUID
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import create_access_token, verify_admin_token
from app.config import settings
from app.database import get_db
from app.models import Guest, RsvpStatus
from app.rate_limit import client_ip, limiter
from app.schemas import (
    AdminLogin,
    DashboardStats,
    GuestCreate,
    GuestOut,
    InviteCreate,
    InviteListItem,
    InviteOut,
    InviteUpdate,
    TokenOut,
)
from app.services import (
    create_invite,
    delete_invite,
    get_dashboard_stats,
    get_invite_by_id,
    invite_counts,
    list_invites,
    serialize_invite,
    update_invite,
)
from app.sessions import clear_admin_session, set_admin_session

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/login", response_model=TokenOut)
def login(payload: AdminLogin, request: Request, response: Response) -> TokenOut:
    limiter.hit(f"admin-login:{client_ip(request)}", limit=5, window_seconds=60)
    expected = settings.admin_password
    provided = payload.password
    try:
        valid = secrets.compare_digest(provided, expected)
    except (TypeError, ValueError):
        valid = False
    if not valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    token = create_access_token()
    set_admin_session(response, token)
    return TokenOut(access_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    clear_admin_session(response)


@router.get("/stats", response_model=DashboardStats)
def stats(_: str = Depends(verify_admin_token), db: Session = Depends(get_db)) -> DashboardStats:
    return DashboardStats(**get_dashboard_stats(db))


@router.get("/invites", response_model=list[InviteListItem])
def get_invites(_: str = Depends(verify_admin_token), db: Session = Depends(get_db)) -> list[InviteListItem]:
    invites = list_invites(db)
    items: list[InviteListItem] = []
    for invite in invites:
        attending, pending, declined = invite_counts(invite)
        items.append(
            InviteListItem(
                id=invite.id,
                token=invite.token,
                household_name=invite.household_name,
                email=invite.email,
                max_guests=invite.max_guests,
                guest_count=len(invite.guests),
                attending_count=attending,
                pending_count=pending,
                declined_count=declined,
                created_at=invite.created_at,
            )
        )
    return items


@router.post("/invites", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
def post_invite(
    payload: InviteCreate,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> InviteOut:
    if len(payload.guests) > payload.max_guests:
        raise HTTPException(status_code=400, detail="Guest list exceeds max_guests")
    invite = create_invite(db, payload)
    return serialize_invite(invite)


@router.get("/invites/{invite_id}", response_model=InviteOut)
def get_invite(
    invite_id: UUID,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> InviteOut:
    invite = get_invite_by_id(db, invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    return serialize_invite(invite)


@router.patch("/invites/{invite_id}", response_model=InviteOut)
def patch_invite(
    invite_id: UUID,
    payload: InviteUpdate,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> InviteOut:
    invite = get_invite_by_id(db, invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    updated = update_invite(db, invite, payload)
    return serialize_invite(updated)


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_invite(
    invite_id: UUID,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> None:
    invite = get_invite_by_id(db, invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    delete_invite(db, invite)


@router.post("/invites/{invite_id}/guests", response_model=GuestOut, status_code=status.HTTP_201_CREATED)
def add_guest(
    invite_id: UUID,
    payload: GuestCreate,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> GuestOut:
    invite = get_invite_by_id(db, invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if len(invite.guests) >= invite.max_guests:
        raise HTTPException(status_code=400, detail="Invite is at max guest capacity")
    guest = Guest(
        invite_id=invite.id,
        name=payload.name,
        is_primary=payload.is_primary,
        sort_order=payload.sort_order or len(invite.guests),
        rsvp_status=RsvpStatus.pending,
    )
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return guest


@router.delete("/invites/{invite_id}/guests/{guest_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_guest(
    invite_id: UUID,
    guest_id: UUID,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> None:
    invite = get_invite_by_id(db, invite_id)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    guest = next((g for g in invite.guests if g.id == guest_id), None)
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    if len(invite.guests) <= 1:
        raise HTTPException(status_code=400, detail="Invite must have at least one guest")
    db.delete(guest)
    db.commit()
