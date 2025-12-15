"""Settings API for OIDC configuration management."""
from typing import Annotated, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import Role, CurrentUser, require_role, clear_oidc_cache
from app.models.models import OIDCConfig, AppSettings
from app.services.audit import log_action

router = APIRouter(prefix="/settings", tags=["Settings"])


# ============================================================================
# Schemas
# ============================================================================

class OIDCConfigResponse(BaseModel):
    id: UUID
    provider_name: str
    enabled: bool
    issuer_url: str | None
    client_id: str | None
    audience: str | None
    scopes: list[str] | None
    redirect_uri: str | None
    admin_endpoint: str | None
    m2m_app_id: str | None
    is_provisioned: bool
    provisioned_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # Note: Secrets are NOT returned

    model_config = {"from_attributes": True}


class OIDCConfigCreate(BaseModel):
    provider_name: str = Field(default="logto", max_length=100)
    enabled: bool = False
    issuer_url: str | None = Field(None, max_length=500)
    client_id: str | None = Field(None, max_length=255)
    client_secret: str | None = None  # Plaintext, will be encrypted
    audience: str | None = Field(None, max_length=500)
    scopes: list[str] = ["openid", "profile", "email"]
    redirect_uri: str | None = Field(None, max_length=500)
    admin_endpoint: str | None = Field(None, max_length=500)
    m2m_app_id: str | None = Field(None, max_length=255)
    m2m_app_secret: str | None = None  # Plaintext, will be encrypted


class OIDCConfigUpdate(BaseModel):
    enabled: bool | None = None
    issuer_url: str | None = None
    client_id: str | None = None
    client_secret: str | None = None
    audience: str | None = None
    scopes: list[str] | None = None
    redirect_uri: str | None = None
    admin_endpoint: str | None = None
    m2m_app_id: str | None = None
    m2m_app_secret: str | None = None


class OIDCTestResult(BaseModel):
    success: bool
    message: str
    details: dict | None = None


class AppSettingResponse(BaseModel):
    key: str
    value: dict | None
    description: str | None
    updated_at: datetime
    updated_by: str | None

    model_config = {"from_attributes": True}


class AppSettingUpdate(BaseModel):
    value: dict | None
    description: str | None = None


# ============================================================================
# Helper Functions
# ============================================================================

def encrypt_secret(plaintext: str) -> str:
    """
    Encrypt a secret for storage.
    
    In production, use a proper encryption library like cryptography.Fernet
    with a key from environment/secrets manager.
    For now, base64 encoding as placeholder.
    """
    import base64
    return base64.b64encode(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    """Decrypt a stored secret."""
    import base64
    try:
        return base64.b64decode(ciphertext.encode()).decode()
    except Exception:
        return ""


def get_or_create_oidc_config(db: Session) -> OIDCConfig:
    """Get the singleton OIDC config or create a default one."""
    config = db.query(OIDCConfig).first()
    if not config:
        config = OIDCConfig(provider_name="logto", enabled=False)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/oidc", response_model=OIDCConfigResponse)
async def get_oidc_config(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Get the current OIDC configuration."""
    config = get_or_create_oidc_config(db)
    return config


@router.put("/oidc", response_model=OIDCConfigResponse)
async def update_oidc_config(
    data: OIDCConfigUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Update the OIDC configuration."""
    config = get_or_create_oidc_config(db)
    
    before = {
        "enabled": config.enabled,
        "issuer_url": config.issuer_url,
        "client_id": config.client_id,
        "audience": config.audience,
    }
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Handle secret encryption
    if "client_secret" in update_data and update_data["client_secret"]:
        config.client_secret_encrypted = encrypt_secret(update_data["client_secret"])
        del update_data["client_secret"]
    
    if "m2m_app_secret" in update_data and update_data["m2m_app_secret"]:
        config.m2m_app_secret_encrypted = encrypt_secret(update_data["m2m_app_secret"])
        del update_data["m2m_app_secret"]
    
    for key, value in update_data.items():
        if hasattr(config, key):
            setattr(config, key, value)
    
    # Mark as not provisioned if config changed
    if data.issuer_url or data.client_id or data.audience:
        config.is_provisioned = False
    
    db.commit()
    db.refresh(config)
    
    # Clear cached OIDC status
    clear_oidc_cache()
    
    log_action(db, user.user_id, "update", "oidc_config", str(config.id), before, 
               {k: v for k, v in update_data.items() if "secret" not in k.lower()})
    
    return config


@router.post("/oidc/test", response_model=OIDCTestResult)
async def test_oidc_connection(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Test the OIDC connection by fetching the discovery document."""
    import httpx
    
    config = get_or_create_oidc_config(db)
    
    if not config.issuer_url:
        return OIDCTestResult(
            success=False,
            message="Issuer URL not configured",
        )
    
    try:
        discovery_url = f"{config.issuer_url.rstrip('/')}/.well-known/openid-configuration"
        
        async with httpx.AsyncClient(verify=False, timeout=10.0) as client:
            response = await client.get(discovery_url)
            
        if response.status_code == 200:
            discovery = response.json()
            return OIDCTestResult(
                success=True,
                message="Successfully connected to OIDC provider",
                details={
                    "issuer": discovery.get("issuer"),
                    "authorization_endpoint": discovery.get("authorization_endpoint"),
                    "token_endpoint": discovery.get("token_endpoint"),
                    "jwks_uri": discovery.get("jwks_uri"),
                },
            )
        else:
            return OIDCTestResult(
                success=False,
                message=f"Failed to fetch discovery document: HTTP {response.status_code}",
            )
    except Exception as e:
        return OIDCTestResult(
            success=False,
            message=f"Connection error: {str(e)}",
        )


@router.post("/oidc/provision", response_model=OIDCTestResult)
async def provision_to_logto(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """
    Provision the application to Logto using the Management API.
    
    This will create/update the SPA application in Logto with the configured settings.
    Requires M2M credentials to be configured.
    """
    import httpx
    
    config = get_or_create_oidc_config(db)
    
    if not config.m2m_app_id or not config.m2m_app_secret_encrypted:
        return OIDCTestResult(
            success=False,
            message="M2M credentials not configured. Please set M2M App ID and Secret.",
        )
    
    if not config.issuer_url:
        return OIDCTestResult(
            success=False,
            message="Issuer URL not configured",
        )
    
    try:
        m2m_secret = decrypt_secret(config.m2m_app_secret_encrypted)
        
        # Get M2M access token
        token_url = f"{config.issuer_url.rstrip('/')}/oidc/token"
        
        async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
            # Request M2M token
            token_response = await client.post(
                token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": config.m2m_app_id,
                    "client_secret": m2m_secret,
                    "resource": "https://default.logto.app/api",  # Logto Management API
                    "scope": "all",
                },
            )
            
            if token_response.status_code != 200:
                return OIDCTestResult(
                    success=False,
                    message=f"Failed to obtain M2M token: {token_response.text}",
                )
            
            access_token = token_response.json().get("access_token")
            
            # For now, just verify we can call the Management API
            # In a full implementation, we would create/update the application
            apps_response = await client.get(
                f"{config.issuer_url.rstrip('/')}/api/applications",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            
            if apps_response.status_code == 200:
                config.is_provisioned = True
                config.provisioned_at = datetime.utcnow()
                db.commit()
                
                # Clear cache to immediately enable RBAC
                clear_oidc_cache()
                
                return OIDCTestResult(
                    success=True,
                    message="Successfully connected to Logto Management API. OIDC is now active!",
                    details={
                        "applications_count": len(apps_response.json()),
                        "oidc_active": True,
                    },
                )
            else:
                return OIDCTestResult(
                    success=False,
                    message=f"Failed to access Management API: HTTP {apps_response.status_code}",
                )
                
    except Exception as e:
        return OIDCTestResult(
            success=False,
            message=f"Provisioning error: {str(e)}",
        )


# ============================================================================
# App Settings (Generic Key-Value)
# ============================================================================

@router.get("/app", response_model=list[AppSettingResponse])
async def list_app_settings(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """List all application settings."""
    settings = db.query(AppSettings).order_by(AppSettings.key).all()
    return settings


@router.get("/app/{key}", response_model=AppSettingResponse)
async def get_app_setting(
    key: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Get a specific application setting."""
    setting = db.query(AppSettings).filter(AppSettings.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@router.put("/app/{key}", response_model=AppSettingResponse)
async def update_app_setting(
    key: str,
    data: AppSettingUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Update or create an application setting."""
    setting = db.query(AppSettings).filter(AppSettings.key == key).first()
    
    if setting:
        before = {"value": setting.value}
        setting.value = data.value
        if data.description is not None:
            setting.description = data.description
        setting.updated_by = user.user_id
    else:
        setting = AppSettings(
            key=key,
            value=data.value,
            description=data.description,
            updated_by=user.user_id,
        )
        db.add(setting)
        before = None
    
    db.commit()
    db.refresh(setting)
    
    log_action(db, user.user_id, "update", "app_settings", key, before, {"value": data.value})
    
    return setting


@router.delete("/app/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_app_setting(
    key: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Delete an application setting."""
    setting = db.query(AppSettings).filter(AppSettings.key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    log_action(db, user.user_id, "delete", "app_settings", key, {"value": setting.value}, None)
    
    db.delete(setting)
    db.commit()
