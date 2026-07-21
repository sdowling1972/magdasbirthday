from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Guest, Invite, Photo, PhotoStatus, RsvpStatus
from app.schemas import InviteCreate, InviteOut, InviteUpdate


def invite_counts(invite: Invite) -> tuple[int, int, int]:
    attending = sum(1 for g in invite.guests if g.rsvp_status == RsvpStatus.attending)
    pending = sum(1 for g in invite.guests if g.rsvp_status == RsvpStatus.pending)
    declined = sum(1 for g in invite.guests if g.rsvp_status == RsvpStatus.declined)
    return attending, pending, declined


def serialize_invite(invite: Invite) -> InviteOut:
    attending, pending, declined = invite_counts(invite)
    return InviteOut(
        id=invite.id,
        token=invite.token,
        household_name=invite.household_name,
        email=invite.email,
        max_guests=invite.max_guests,
        notes=invite.notes,
        created_at=invite.created_at,
        updated_at=invite.updated_at,
        guests=invite.guests,
        attending_count=attending,
        pending_count=pending,
        declined_count=declined,
    )


def get_invite_by_id(db: Session, invite_id: UUID) -> Invite | None:
    return db.scalar(
        select(Invite).options(selectinload(Invite.guests), selectinload(Invite.photos)).where(Invite.id == invite_id)
    )


def get_invite_by_token(db: Session, token: str) -> Invite | None:
    from app.invite_codes import normalize_invite_code

    code = normalize_invite_code(token)
    return db.scalar(
        select(Invite).options(selectinload(Invite.guests), selectinload(Invite.photos)).where(Invite.token == code)
    )


def list_invites(db: Session) -> list[Invite]:
    return list(
        db.scalars(
            select(Invite)
            .options(selectinload(Invite.guests))
            .order_by(Invite.created_at.desc())
        ).all()
    )


def create_invite(db: Session, payload: InviteCreate) -> Invite:
    invite = Invite(
        household_name=payload.household_name,
        email=str(payload.email) if payload.email else None,
        max_guests=payload.max_guests,
        notes=payload.notes,
    )
    for index, guest_data in enumerate(payload.guests):
        invite.guests.append(
            Guest(
                name=guest_data.name,
                is_primary=guest_data.is_primary or index == 0,
                sort_order=guest_data.sort_order if guest_data.sort_order else index,
            )
        )
    if not any(g.is_primary for g in invite.guests) and invite.guests:
        invite.guests[0].is_primary = True

    db.add(invite)
    db.commit()
    db.refresh(invite)
    return get_invite_by_id(db, invite.id)  # type: ignore[return-value]


def update_invite(db: Session, invite: Invite, payload: InviteUpdate) -> Invite:
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        data["email"] = str(data["email"])
    for key, value in data.items():
        setattr(invite, key, value)
    db.commit()
    return get_invite_by_id(db, invite.id)  # type: ignore[return-value]


def delete_invite(db: Session, invite: Invite) -> None:
    db.delete(invite)
    db.commit()


def get_dashboard_stats(db: Session) -> dict:
    invite_count = db.scalar(select(func.count()).select_from(Invite)) or 0
    guest_count = db.scalar(select(func.count()).select_from(Guest)) or 0
    attending = (
        db.scalar(select(func.count()).select_from(Guest).where(Guest.rsvp_status == RsvpStatus.attending)) or 0
    )
    declined = (
        db.scalar(select(func.count()).select_from(Guest).where(Guest.rsvp_status == RsvpStatus.declined)) or 0
    )
    pending = (
        db.scalar(select(func.count()).select_from(Guest).where(Guest.rsvp_status == RsvpStatus.pending)) or 0
    )
    photos_pending = (
        db.scalar(select(func.count()).select_from(Photo).where(Photo.status == PhotoStatus.pending)) or 0
    )
    photos_approved = (
        db.scalar(select(func.count()).select_from(Photo).where(Photo.status == PhotoStatus.approved)) or 0
    )
    return {
        "invite_count": invite_count,
        "guest_count": guest_count,
        "attending_count": attending,
        "declined_count": declined,
        "pending_count": pending,
        "photos_pending": photos_pending,
        "photos_approved": photos_approved,
    }
