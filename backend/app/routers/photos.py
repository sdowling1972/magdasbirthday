import uuid
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.auth import ALGORITHM, verify_admin_token
from app.config import settings
from app.database import get_db
from app.invite_codes import require_invite_code, resolve_invite_code
from app.models import Invite, Photo, PhotoStatus
from app.notifications import notify_photo_upload
from app.notify_once import claim_notification
from app.rate_limit import client_ip, limiter
from app.schemas import AlbumContributor, PhotoAdminUpdate, PhotoOut, PhotoPage
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
    household = None
    if getattr(photo, "invite", None) is not None:
        household = photo.invite.household_name
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
        household_name=household,
    )


def paginate_photos(
    db: Session,
    *,
    status_filter: PhotoStatus | None,
    page: int,
    page_size: int,
    invite_id: UUID | None = None,
) -> PhotoPage:
    filters: list = []
    if status_filter is not None:
        filters.append(Photo.status == status_filter)
    if invite_id is not None:
        filters.append(Photo.invite_id == invite_id)
    total = db.scalar(select(func.count()).select_from(Photo).where(*filters)) or 0
    page_count = max(1, (total + page_size - 1) // page_size) if total else 1
    safe_page = min(page, page_count)
    photos = db.scalars(
        select(Photo)
        .options(selectinload(Photo.invite))
        .where(*filters)
        .order_by(Photo.created_at.desc())
        .offset((safe_page - 1) * page_size)
        .limit(page_size)
    ).all()
    return PhotoPage(
        items=[serialize_photo(p) for p in photos],
        total=total,
        page=safe_page,
        page_size=page_size,
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


@router.get("/album/contributors", response_model=list[AlbumContributor])
def album_contributors(
    db: Session = Depends(get_db),
) -> list[AlbumContributor]:
    return list_contributors(db, status_filter=PhotoStatus.approved)


def list_contributors(
    db: Session,
    *,
    status_filter: PhotoStatus | None,
) -> list[AlbumContributor]:
    filters = [Photo.status == status_filter] if status_filter is not None else []
    rows = db.execute(
        select(Invite.id, Invite.household_name, func.count(Photo.id))
        .join(Photo, Photo.invite_id == Invite.id)
        .where(*filters)
        .group_by(Invite.id, Invite.household_name)
        .order_by(func.lower(Invite.household_name))
    ).all()
    return [
        AlbumContributor(invite_id=row[0], household_name=row[1], photo_count=row[2])
        for row in rows
    ]


@router.get("/admin/contributors", response_model=list[AlbumContributor])
def admin_contributors(
    status_filter: PhotoStatus | None = None,
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> list[AlbumContributor]:
    return list_contributors(db, status_filter=status_filter)


@router.get("/album", response_model=PhotoPage)
def public_album(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=2000),
    invite_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
) -> PhotoPage:
    return paginate_photos(
        db,
        status_filter=PhotoStatus.approved,
        page=page,
        page_size=page_size,
        invite_id=invite_id,
    )


@router.get("/admin", response_model=PhotoPage)
def admin_list_photos(
    status_filter: PhotoStatus | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=2000),
    invite_id: UUID | None = Query(None),
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> PhotoPage:
    return paginate_photos(
        db,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
        invite_id=invite_id,
    )


@router.get("/admin/album", response_model=PhotoPage)
def admin_album(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=2000),
    invite_id: UUID | None = Query(None),
    _: str = Depends(verify_admin_token),
    db: Session = Depends(get_db),
) -> PhotoPage:
    return paginate_photos(
        db,
        status_filter=PhotoStatus.approved,
        page=page,
        page_size=page_size,
        invite_id=invite_id,
    )


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
    elif photo.status == PhotoStatus.approved:
        # Approved album photos are publicly viewable.
        allowed = True
    else:
        code = resolve_invite_code(request)
        if not code:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        invite = get_invite_by_token(db, code)
        if not invite:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        # Guests may view any photo from their own invite (including pending).
        allowed = photo.invite_id == invite.id

    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")

    opened = get_storage().open(filename)
    if not opened:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = opened
    cache = "public, max-age=3600" if photo.status == PhotoStatus.approved else "private, max-age=3600"
    return Response(
        content=data,
        media_type=photo.content_type or content_type,
        headers={"Cache-Control": cache},
    )
