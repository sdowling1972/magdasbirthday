"""Build admin notification emails for RSVP and photo activity."""

from __future__ import annotations

from app.mail import send_email


def notify_rsvp_update(
    *,
    household_name: str,
    invite_id: str,
    before_email: str | None,
    after_email: str | None,
    before_comments: str | None,
    after_comments: str | None,
    before_guests: list[dict[str, str | None]],
    after_guests: list[dict[str, str | None]],
) -> None:
    lines: list[str] = [
        f"Household: {household_name}",
        f"Invite id: {invite_id}",
        "",
        "Contact email:",
        f"  before: {before_email or '(none)'}",
        f"  after:  {after_email or '(none)'}",
        "",
        "General comments:",
        f"  before: {before_comments or '(none)'}",
        f"  after:  {after_comments or '(none)'}",
        "",
        "Guests:",
    ]

    before_by_id = {g["id"]: g for g in before_guests}
    for guest in after_guests:
        prev = before_by_id.get(guest["id"] or "", {})
        lines.append(f"  • {guest.get('name') or 'Guest'}")
        lines.append(
            f"      RSVP: {prev.get('rsvp_status') or 'unknown'} → {guest.get('rsvp_status') or 'unknown'}"
        )
        lines.append(f"      Message before: {prev.get('message') or '(none)'}")
        lines.append(f"      Message after:  {guest.get('message') or '(none)'}")

    attending = [g["name"] for g in after_guests if g.get("rsvp_status") == "attending" and g.get("name")]
    declined = [g["name"] for g in after_guests if g.get("rsvp_status") == "declined" and g.get("name")]
    pending = [g["name"] for g in after_guests if g.get("rsvp_status") == "pending" and g.get("name")]
    lines.extend(
        [
            "",
            f"Attending ({len(attending)}): {', '.join(attending) or '(none)'}",
            f"Declined ({len(declined)}): {', '.join(declined) or '(none)'}",
            f"Pending ({len(pending)}): {', '.join(pending) or '(none)'}",
        ]
    )

    send_email(
        subject=f"RSVP update — {household_name}",
        body="\n".join(lines),
    )


def notify_photo_upload(
    *,
    household_name: str,
    invite_id: str,
    contact_email: str | None,
    uploader_name: str,
    caption: str | None,
    original_filename: str,
    filename: str,
    content_type: str,
    photo_id: str,
    status: str,
) -> None:
    lines = [
        f"Household: {household_name}",
        f"Invite id: {invite_id}",
        f"Contact email: {contact_email or '(none)'}",
        "",
        "Photo uploaded (pending approval):",
        f"  Credit: {uploader_name}",
        f"  Caption: {caption or '(none)'}",
        f"  Original filename: {original_filename}",
        f"  Stored as: {filename}",
        f"  Content type: {content_type}",
        f"  Photo id: {photo_id}",
        f"  Status: {status}",
    ]
    send_email(
        subject=f"Photo uploaded — {household_name}",
        body="\n".join(lines),
    )
