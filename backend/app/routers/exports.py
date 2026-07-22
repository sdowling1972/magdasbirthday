import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select

from app.auth import verify_admin_token
from app.database import get_db
from app.invite_codes import format_invite_code
from app.models import Invite, RsvpStatus

router = APIRouter(prefix="/api/admin/exports", tags=["admin-exports"])


def _csv_response(filename: str, rows: list[list[object]]) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    for row in rows:
        writer.writerow(row)
    # UTF-8 BOM helps Excel open accented characters correctly
    payload = "\ufeff" + buffer.getvalue()
    return StreamingResponse(
        iter([payload]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _load_invites(db: Session) -> list[Invite]:
    return list(
        db.scalars(
            select(Invite)
            .options(selectinload(Invite.guests), selectinload(Invite.photos))
            .order_by(Invite.household_name.asc())
        ).all()
    )


def invitation_message(household_name: str, invite_url: str) -> str:
    return (
        f"Hey {household_name}! 🎂\n"
        "\n"
        "Sean here — marking your calendar FOR you: Magda's birthday party is happening and you're invited!\n"
        "\n"
        "Here's the scoop:\n"
        "📅 Saturday, August 15 (backup date: August 22)\n"
        "📍 38 Bowcott Cres, London (Magda's place)\n"
        "🕑 Swing by whenever between 2–7pm — no strict schedule, just good vibes\n"
        "🍕 Party food + refreshments = taken care of\n"
        "🎉 Surprise? Nope! Magda knows and she's hyped!\n"
        "\n"
        "All we need from you: click the link, tell us you're coming (and how many!), and maybe dig up a "
        "favourite photo with the birthday girl to share with everyone.\n"
        "\n"
        f"👉 {invite_url}\n"
        "\n"
        "See you there! 🥂\n"
        "\n"
        "— Sean"
    )


@router.get("/invitee-status")
def export_invitee_status(
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    rows: list[list[object]] = [
        [
            "Household",
            "Email",
            "Notes",
            "Max guests",
            "Confirmed guests",
            "Confirmed guest list",
            "Message to Magda",
            "General comments",
            "Number of photos",
        ]
    ]
    for invite in _load_invites(db):
        attending = sorted(
            [g for g in invite.guests if g.rsvp_status == RsvpStatus.attending],
            key=lambda g: (g.sort_order, g.name),
        )
        primary = next((g for g in invite.guests if g.is_primary), None) or (
            invite.guests[0] if invite.guests else None
        )
        message = (primary.message if primary else None) or ""
        rows.append(
            [
                invite.household_name,
                invite.email or "",
                invite.notes or "",
                invite.max_guests,
                len(attending),
                ", ".join(g.name for g in attending),
                message,
                invite.general_comments or "",
                len(invite.photos),
            ]
        )
    stamp = date.today().isoformat()
    return _csv_response(f"magda-invitee-status-{stamp}.csv", rows)


@router.get("/invitations")
def export_invitations(
    base_url: str = Query(
        default="https://magdas-big-bday.com",
        description="Site origin used to build personalized invite links",
    ),
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    origin = base_url.rstrip("/")
    rows: list[list[object]] = [["Household", "Login code", "Personalized message"]]
    for invite in _load_invites(db):
        code = format_invite_code(invite.token)
        invite_url = f"{origin}/autologin?key={invite.token}"
        rows.append(
            [
                invite.household_name,
                code,
                invitation_message(invite.household_name, invite_url),
            ]
        )
    stamp = date.today().isoformat()
    return _csv_response(f"magda-invitations-{stamp}.csv", rows)
