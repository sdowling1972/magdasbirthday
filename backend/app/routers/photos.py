import uuid
from pathlib import Path
from uuid import UUID

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import verify_admin_token
from app.config import settings
from app.database import get_db
from app.invite_codes import require_invite_code
from app.models import Invite, Photo, PhotoStatus
from app.schemas import PhotoOut, PhotoStatusUpdate
from app.services import get_invite_by_token

router = APIRouter(prefix="/api/photos", tags=["photos"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 15 * 1024 * 1024


def upload_root() -> Path:
    path = Path(settings.upload_dir)
    if not path.is_absolute():
        path = Path(__file__).resolve().parents[2] / path
    path.mkdir(parents=True, exist_ok=True)
    return path


def photo_url(photo: Photo) -> str:
    return f"/api/photos/files/{photo.filename}"


def serialize_photo(photo: Photo) -> PhotoOut:
    return PhotoOut(
        id=photo.id,
        invite_id=photo.invite_id,
        uploader_name=photo.uploader_name,
        caption=photo.caption,
        filename=photo.filename,
        original_filename=photo.original_filename,
        content_type=photo.content_type,
        status=photo.status,
        created_at=photo.created_at,
        url=photo_url(photo),
    )


@router.post("/rsvp/{token}", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    token: str,
    uploader_name: str = Form(...),
    caption: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> PhotoOut:
    invite = get_invite_by_token(db, token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and GIF images are allowed")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 15MB)")

    ext = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }[content_type]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest = upload_root() / stored_name
    async with aiofiles.open(dest, "wb") as out:
        await out.write(data)

    photo = Photo(
        invite_id=invite.id,
        uploader_name=uploader_name.strip() or invite.household_name,
        caption=caption,
        filename=stored_name,
        original_filename=file.filename or stored_name,
        content_type=content_type,
        status=PhotoStatus.pending,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return serialize_photo(photo)


@router.get("/rsvp/{token}", response_model=list[PhotoOut])
def list_invite_photos(token: str, db: Session = Depends(get_db)) -> list[PhotoOut]:
    invite = get_invite_by_token(db, token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    photos = db.scalars(
        select(Photo).where(Photo.invite_id == invite.id).order_by(Photo.created_at.desc())
    ).all()
    return [serialize_photo(p) for p in photos]


@router.get("/album", response_model=list[PhotoOut])
def public_album(
    _: Invite = Depends(require_invite_code),
    db: Session = Depends(get_db),
) -> list[PhotoOut]:
    photos = db.scalars(
        select(Photo).where(Photo.status == PhotoStatus.approved).order_by(Photo.created_at.desc())
    ).all()
    return [serialize_photo(p) for p in photos]


@router.get("/admin", response_model=list[PhotoOut])
def admin_list_photos(
    status_filter: PhotoStatus | None = None,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> list[PhotoOut]:
    stmt = select(Photo).order_by(Photo.created_at.desc())
    if status_filter:
        stmt = stmt.where(Photo.status == status_filter)
    photos = db.scalars(stmt).all()
    return [serialize_photo(p) for p in photos]


@router.patch("/admin/{photo_id}", response_model=PhotoOut)
def update_photo_status(
    photo_id: UUID,
    payload: PhotoStatusUpdate,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> PhotoOut:
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    photo.status = payload.status
    db.commit()
    db.refresh(photo)
    return serialize_photo(photo)


@router.delete("/admin/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    photo_id: UUID,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> None:
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    path = upload_root() / photo.filename
    if path.exists():
        path.unlink()
    db.delete(photo)
    db.commit()


@router.get("/files/{filename}")
def serve_file(filename: str) -> FileResponse:
    # Prevent path traversal
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = upload_root() / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)
