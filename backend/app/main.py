from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.invite_codes import CODE_LENGTH, generate_invite_code, normalize_invite_code
from app.models import Invite
from app.routers import admin, auth, party, photos, rsvp

Base.metadata.create_all(bind=engine)


def migrate_invite_codes() -> None:
    """Ensure every invite uses a 16-character uppercase A–Z code."""
    db = SessionLocal()
    try:
        invites = list(db.scalars(select(Invite)).all())
        existing = {inv.token for inv in invites}
        changed = False
        for invite in invites:
            normalized = normalize_invite_code(invite.token)
            if len(normalized) == CODE_LENGTH and normalized == invite.token:
                continue
            new_code = generate_invite_code()
            while new_code in existing:
                new_code = generate_invite_code()
            existing.discard(invite.token)
            existing.add(new_code)
            invite.token = new_code
            changed = True
        if changed:
            db.commit()
    finally:
        db.close()


migrate_invite_codes()

app = FastAPI(title="Magda's Big Birthday Party API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(party.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(rsvp.router)
app.include_router(photos.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "magdas-big-birthday-api"}
