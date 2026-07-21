from fastapi import APIRouter, Depends

from app.config import settings
from app.invite_codes import require_invite_code
from app.models import Invite
from app.schemas import PartyInfo

router = APIRouter(prefix="/api", tags=["party"])


@router.get("/party", response_model=PartyInfo)
def get_party(_: Invite = Depends(require_invite_code)) -> PartyInfo:
    return PartyInfo(
        name=settings.party_name,
        date=settings.party_date,
        location=settings.party_location,
        description=settings.party_description,
    )


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
