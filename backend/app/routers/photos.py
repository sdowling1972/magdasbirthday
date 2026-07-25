import uuid
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import ALGORITHM, verify_admin_token
from app.config import settings
from app.database import get_db
from app.invite_codes import require_invite_code, resolve_invite_code
from app.models import Invite, Photo, PhotoStatus
from app.notifications import notify_photo_upload
from app.notify_once import claim_notification
from app.rate_limit import client_ip, limiter
from app.schemas import PhotoAdminUpdate, PhotoOut
from app.services import get_invite_by_token
from app.sessions import ADMIN_COOKIE
from app.storage import get_storage

router = APIRouter(prefix="/api/photos", tags=["photos"])
security = HTTPBearer(auto_error=False)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_BYTES = 15 * 1024 * 1024


def photo_url(photo: Photo) -> str:
    return get_storage().public_url(photo.filename)


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


def _is_admin(request: Request, credentials: HTTPAuthorizationCredentials | None) -> bool:
    token = credentials.credentials if credentials else request.cookies.get(ADMIN_COOKIE)
    if not token:
        return False
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload.get("sub") == "admin"
    except JWTError:
        return False


@router.post("/mine", response_model=PhotoOut, status_code=status.HTTP_201_CREATED)
async def upload_photo(
    request: Request,
    background_tasks: BackgroundTasks,
    uploader_name: str = Form(...),
    caption: str | None = Form(None),
    file: UploadFile = File(...),
    invite: Invite = Depends(require_invite_code),
    db: Session = Depends(get_db),
) -> PhotoOut:
    limiter.hit(f"photo-upload:{invite.id}:{client_ip(request)}", limit=100, window_seconds=3600)

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
    get_storage().save(stored_name, data, content_type)

    photo = Photo(
        invite_id=invite.id,
        uploader_name=(uploader_name.strip() if uploader_name else "")
        or f"Credit: {invite.household_name}",
        caption=(caption.strip() if caption else None) or None,
        filename=stored_name,
        original_filename=file.filename or stored_name,
        content_type=content_type,
        status=PhotoStatus.pending,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)

    # One photo-upload email per guest browser session.
    if claim_notification(request, "photo"):
        background_tasks.add_task(
            notify_photo_upload,
            household_name=invite.household_name,
            invite_id=str(invite.id),
            contact_email=invite.email,
            uploader_name=photo.uploader_name,
            caption=photo.caption,
            original_filename=photo.original_filename,
            filename=photo.filename,
            content_type=photo.content_type,
            photo_id=str(photo.id),
            status=photo.status.value,
        )
    return serialize_photo(photo)


@router.get("/mine", response_model=list[PhotoOut])
def list_invite_photos(
    invite: Invite = Depends(require_invite_code),
    db: Session = Depends(get_db),
) -> list[PhotoOut]:
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
def update_photo(
    photo_id: UUID,
    payload: PhotoAdminUpdate,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> PhotoOut:
    photo = db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    fields = payload.model_fields_set
    if not fields.intersection({"status", "caption", "uploader_name"}):
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "status" in fields and payload.status is not None:
        photo.status = payload.status
    if "caption" in fields:
        photo.caption = payload.caption
    if "uploader_name" in fields and payload.uploader_name is not None:
        photo.uploader_name = payload.uploader_name
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
    get_storage().delete(photo.filename)
    db.delete(photo)
    db.commit()


@router.get("/files/{filename}")
def serve_file(
    filename: str,
    request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> Response:
    if "/" in filename or "\\" in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")

    photo = db.scalar(select(Photo).where(Photo.filename == filename))
    if not photo:
        raise HTTPException(status_code=404, detail="File not found")

    if _is_admin(request, credentials):
        allowed = True
    else:
        code = resolve_invite_code(request)
        if not code:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        invite = get_invite_by_token(db, code)
        if not invite:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        # Guests may view approved album photos, or any photo from their own invite
        allowed = photo.status == PhotoStatus.approved or photo.invite_id == invite.id

    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    opened = get_storage().open(filename)
    if not opened:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = opened
    return Response(
        content=data,
        media_type=photo.content_type or content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
