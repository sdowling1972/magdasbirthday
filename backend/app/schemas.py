from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import PhotoStatus, RsvpStatus


class PartyInfo(BaseModel):
    name: str
    date: str
    location: str
    description: str


class GuestBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    is_primary: bool = False
    sort_order: int = 0


class GuestCreate(GuestBase):
    pass


class GuestUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    rsvp_status: RsvpStatus | None = None
    dietary_notes: str | None = None
    message: str | None = None


class GuestRsvpUpdate(BaseModel):
    rsvp_status: RsvpStatus
    dietary_notes: str | None = None
    message: str | None = None


class GuestOut(GuestBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invite_id: UUID
    rsvp_status: RsvpStatus
    dietary_notes: str | None
    message: str | None
    rsvp_at: datetime | None


class InviteCreate(BaseModel):
    household_name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None
    max_guests: int = Field(default=1, ge=1, le=20)
    notes: str | None = None
    guests: list[GuestCreate] = Field(min_length=1)


class InviteUpdate(BaseModel):
    household_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    max_guests: int | None = Field(default=None, ge=1, le=20)
    notes: str | None = None


class InviteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    token: str
    household_name: str
    email: str | None
    max_guests: int
    notes: str | None
    created_at: datetime
    updated_at: datetime
    guests: list[GuestOut]
    attending_count: int = 0
    pending_count: int = 0
    declined_count: int = 0


class InvitePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    household_name: str
    max_guests: int
    guests: list[GuestOut]
    party: PartyInfo


class InviteListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    token: str
    household_name: str
    email: str | None
    max_guests: int
    guest_count: int
    attending_count: int
    pending_count: int
    declined_count: int
    created_at: datetime


class RsvpSubmission(BaseModel):
    guests: list[dict]


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invite_id: UUID
    uploader_name: str
    caption: str | None
    filename: str
    original_filename: str
    content_type: str
    status: PhotoStatus
    created_at: datetime
    url: str | None = None


class PhotoStatusUpdate(BaseModel):
    status: PhotoStatus


class AdminLogin(BaseModel):
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DashboardStats(BaseModel):
    invite_count: int
    guest_count: int
    attending_count: int
    declined_count: int
    pending_count: int
    photos_pending: int
    photos_approved: int
