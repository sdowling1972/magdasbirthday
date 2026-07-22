from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.invite_codes import CODE_LENGTH, generate_invite_code, normalize_invite_code
from app.models import Invite
from app.routers import admin, auth, exports, party, photos, rsvp
from app.sessions import SessionCookieCleanupMiddleware

Base.metadata.create_all(bind=engine)


def migrate_schema() -> None:
    """Add columns introduced after the initial create_all."""
    with engine.begin() as conn:
        conn.exec_driver_sql(
            "ALTER TABLE invites ADD COLUMN IF NOT EXISTS general_comments TEXT"
        )


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


migrate_schema()
migrate_invite_codes()

_docs = None if settings.is_production else "/docs"
_redoc = None if settings.is_production else "/redoc"
_openapi = None if settings.is_production else "/openapi.json"

app = FastAPI(
    title="Magda's Big Birthday Party API",
    version="0.1.0",
    docs_url=_docs,
    redoc_url=_redoc,
    openapi_url=_openapi,
)

app.add_middleware(SessionCookieCleanupMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(party.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(exports.router)
app.include_router(rsvp.router)
app.include_router(photos.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "magdas-big-birthday-api"}
