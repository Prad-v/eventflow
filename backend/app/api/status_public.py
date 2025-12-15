"""Public system status endpoints (no auth required)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import OIDCConfig

router = APIRouter(prefix="/system", tags=["System"])


class OIDCStatusResponse(BaseModel):
    oidc_configured: bool
    oidc_enabled: bool
    oidc_active: bool  # enabled AND provisioned
    provider_name: str | None = None


def is_oidc_active(db: Session) -> bool:
    """Check if OIDC is fully active (enabled AND provisioned)."""
    config = db.query(OIDCConfig).first()
    if not config:
        return False
    return config.enabled and config.is_provisioned


@router.get("/oidc-status", response_model=OIDCStatusResponse)
async def get_oidc_status(
    db: Session = Depends(get_db),
):
    """
    Get OIDC configuration status.
    
    This is a public endpoint that returns whether OIDC is configured and active.
    Used by the frontend to determine if authentication should be required.
    """
    config = db.query(OIDCConfig).first()
    
    if not config:
        return OIDCStatusResponse(
            oidc_configured=False,
            oidc_enabled=False,
            oidc_active=False,
        )
    
    # Configured = has issuer_url and client_id
    is_configured = bool(config.issuer_url and config.client_id)
    
    return OIDCStatusResponse(
        oidc_configured=is_configured,
        oidc_enabled=config.enabled,
        oidc_active=config.enabled and config.is_provisioned,
        provider_name=config.provider_name if is_configured else None,
    )
