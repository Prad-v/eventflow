"""Datasource management API endpoints."""
import json
from typing import Annotated
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import Role, CurrentUser, require_role
from app.models.models import Datasource, ExternalIncident
from app.services.audit import log_action
from app.api.settings import encrypt_secret, decrypt_secret

router = APIRouter(prefix="/settings/datasources", tags=["Datasources"])


# ============================================================================
# Schemas
# ============================================================================

class DatasourceResponse(BaseModel):
    id: UUID
    name: str
    provider_type: str
    enabled: bool
    last_sync_at: datetime | None
    sync_status: str | None
    sync_error: str | None
    sync_interval_seconds: int
    created_at: datetime
    updated_at: datetime
    # Config fields (without secrets)
    has_api_key: bool = False
    service_ids: list[str] = []
    base_url: str | None = None  # Custom endpoint (for mock PD)

    model_config = {"from_attributes": True}


class DatasourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    provider_type: str = Field(default="pagerduty", pattern="^(pagerduty|opsgenie)$")
    api_key: str = Field(..., min_length=1)
    service_ids: list[str] = []
    sync_interval_seconds: int = Field(default=60, ge=30, le=3600)
    base_url: str | None = None  # Custom endpoint URL (e.g., http://mock-pagerduty)


class DatasourceUpdate(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    api_key: str | None = None
    service_ids: list[str] | None = None
    sync_interval_seconds: int | None = Field(default=None, ge=30, le=3600)
    base_url: str | None = None


class TestResult(BaseModel):
    success: bool
    message: str
    details: dict | None = None


class SyncResult(BaseModel):
    success: bool
    created: int = 0
    updated: int = 0
    total_fetched: int = 0
    error: str | None = None


# ============================================================================
# Helper Functions
# ============================================================================

def datasource_to_response(ds: Datasource) -> DatasourceResponse:
    """Convert datasource model to response with config parsing."""
    config = {}
    if ds.config_encrypted:
        try:
            config = json.loads(decrypt_secret(ds.config_encrypted))
        except:
            pass
    
    return DatasourceResponse(
        id=ds.id,
        name=ds.name,
        provider_type=ds.provider_type,
        enabled=ds.enabled,
        last_sync_at=ds.last_sync_at,
        sync_status=ds.sync_status,
        sync_error=ds.sync_error,
        sync_interval_seconds=ds.sync_interval_seconds,
        created_at=ds.created_at,
        updated_at=ds.updated_at,
        has_api_key=bool(config.get("api_key")),
        service_ids=config.get("service_ids", []),
        base_url=config.get("base_url"),
    )


# ============================================================================
# Endpoints
# ============================================================================

@router.get("", response_model=list[DatasourceResponse])
async def list_datasources(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """List all configured datasources."""
    datasources = db.query(Datasource).order_by(Datasource.name).all()
    return [datasource_to_response(ds) for ds in datasources]


@router.post("", response_model=DatasourceResponse, status_code=status.HTTP_201_CREATED)
async def create_datasource(
    data: DatasourceCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Create a new datasource integration."""
    config = {
        "api_key": data.api_key,
        "service_ids": data.service_ids,
    }
    if data.base_url:
        config["base_url"] = data.base_url
    
    datasource = Datasource(
        name=data.name,
        provider_type=data.provider_type,
        config_encrypted=encrypt_secret(json.dumps(config)),
        enabled=False,  # Start disabled
        sync_interval_seconds=data.sync_interval_seconds,
    )
    
    db.add(datasource)
    db.commit()
    db.refresh(datasource)
    
    log_action(db, user.user_id, "create", "datasource", str(datasource.id), None, {"name": data.name, "provider": data.provider_type})
    
    return datasource_to_response(datasource)


@router.get("/{datasource_id}", response_model=DatasourceResponse)
async def get_datasource(
    datasource_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Get a specific datasource."""
    datasource = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")
    return datasource_to_response(datasource)


@router.patch("/{datasource_id}", response_model=DatasourceResponse)
async def update_datasource(
    datasource_id: UUID,
    data: DatasourceUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Update a datasource."""
    datasource = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")
    
    before = {"name": datasource.name, "enabled": datasource.enabled}
    
    if data.name is not None:
        datasource.name = data.name
    if data.enabled is not None:
        datasource.enabled = data.enabled
    if data.sync_interval_seconds is not None:
        datasource.sync_interval_seconds = data.sync_interval_seconds
    
    # Update config if api_key or service_ids changed
    if data.api_key is not None or data.service_ids is not None:
        current_config = {}
        if datasource.config_encrypted:
            try:
                current_config = json.loads(decrypt_secret(datasource.config_encrypted))
            except:
                pass
        
        if data.api_key is not None:
            current_config["api_key"] = data.api_key
        if data.service_ids is not None:
            current_config["service_ids"] = data.service_ids
        if data.base_url is not None:
            current_config["base_url"] = data.base_url
        
        datasource.config_encrypted = encrypt_secret(json.dumps(current_config))
    
    db.commit()
    db.refresh(datasource)
    
    log_action(db, user.user_id, "update", "datasource", str(datasource_id), before, 
               data.model_dump(exclude_unset=True, exclude={"api_key"}))
    
    return datasource_to_response(datasource)


@router.delete("/{datasource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_datasource(
    datasource_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Delete a datasource and all its synced incidents."""
    datasource = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")
    
    log_action(db, user.user_id, "delete", "datasource", str(datasource_id), {"name": datasource.name}, None)
    
    db.delete(datasource)
    db.commit()


@router.post("/{datasource_id}/test", response_model=TestResult)
async def test_datasource(
    datasource_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Test datasource connection."""
    datasource = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")
    
    if datasource.provider_type == "pagerduty":
        from app.services.pagerduty import PagerDutyClient
        
        try:
            config = json.loads(decrypt_secret(datasource.config_encrypted))
            api_key = config.get("api_key")
            base_url = config.get("base_url")
            if not api_key:
                return TestResult(success=False, message="API key not configured")
            
            client = PagerDutyClient(api_key, base_url=base_url)
            result = await client.test_connection()
            
            if result["success"]:
                return TestResult(
                    success=True,
                    message=f"Connected as {result['user']} ({result['email']})",
                    details=result,
                )
            else:
                return TestResult(success=False, message=result["error"])
        except Exception as e:
            return TestResult(success=False, message=str(e))
    
    return TestResult(success=False, message=f"Unknown provider: {datasource.provider_type}")


@router.post("/{datasource_id}/sync", response_model=SyncResult)
async def sync_datasource(
    datasource_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Manually trigger a sync for the datasource."""
    datasource = db.query(Datasource).filter(Datasource.id == datasource_id).first()
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")
    
    if datasource.provider_type == "pagerduty":
        from app.services.pagerduty import sync_pagerduty_incidents
        result = await sync_pagerduty_incidents(db, datasource)
        return SyncResult(**result)
    
    return SyncResult(success=False, error=f"Unknown provider: {datasource.provider_type}")
