"""Maintenance window API routes."""
from typing import Annotated, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import CurrentUser, Role, get_current_user, require_role
from app.models.models import (
    MaintenanceWindow, MaintenanceComponent, Component, MaintenanceStatus
)
from app.schemas.schemas import (
    MaintenanceCreate, MaintenanceUpdate, MaintenanceResponse, 
    MaintenanceDetailResponse, MaintenanceListResponse,
)
from app.services.audit import log_action


router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


@router.get("", response_model=MaintenanceListResponse)
async def list_maintenance(
    db: Annotated[Session, Depends(get_db)],
    status_filter: Optional[MaintenanceStatus] = Query(None, alias="status"),
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List maintenance windows with filtering and pagination."""
    query = db.query(MaintenanceWindow)
    
    if status_filter:
        query = query.filter(MaintenanceWindow.status == status_filter)
    if from_date:
        query = query.filter(MaintenanceWindow.start_at >= from_date)
    if to_date:
        query = query.filter(MaintenanceWindow.end_at <= to_date)
    
    total = query.count()
    windows = query.order_by(MaintenanceWindow.start_at.desc())\
                   .offset((page - 1) * page_size)\
                   .limit(page_size)\
                   .all()
    
    return MaintenanceListResponse(
        items=windows,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{maintenance_id}", response_model=MaintenanceDetailResponse)
async def get_maintenance(
    maintenance_id: UUID,
    db: Annotated[Session, Depends(get_db)],
):
    """Get a single maintenance window with components."""
    window = db.query(MaintenanceWindow)\
        .options(
            joinedload(MaintenanceWindow.maintenance_components).joinedload(MaintenanceComponent.component)
        )\
        .filter(MaintenanceWindow.id == maintenance_id)\
        .first()
    
    if not window:
        raise HTTPException(status_code=404, detail="Maintenance window not found")
    
    return MaintenanceDetailResponse(
        id=window.id,
        title=window.title,
        description=window.description,
        status=window.status,
        start_at=window.start_at,
        end_at=window.end_at,
        created_by=window.created_by,
        created_at=window.created_at,
        updated_at=window.updated_at,
        components=[
            {
                "component_id": mc.component_id,
                "expected_impact": mc.expected_impact,
                "component": mc.component,
            }
            for mc in window.maintenance_components
        ],
    )


@router.post("", response_model=MaintenanceDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_maintenance(
    data: MaintenanceCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Create a new maintenance window."""
    if data.end_at <= data.start_at:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    
    # Validate components exist
    component_ids = [c.component_id for c in data.components]
    if component_ids:
        existing = db.query(Component.id).filter(Component.id.in_(component_ids)).all()
        existing_ids = {c.id for c in existing}
        missing = set(component_ids) - existing_ids
        if missing:
            raise HTTPException(status_code=400, detail=f"Components not found: {missing}")
    
    # Create maintenance window
    window = MaintenanceWindow(
        title=data.title,
        description=data.description,
        start_at=data.start_at,
        end_at=data.end_at,
        created_by=user.user_id,
    )
    db.add(window)
    db.flush()
    
    # Associate components
    for comp_input in data.components:
        mc = MaintenanceComponent(
            maintenance_id=window.id,
            component_id=comp_input.component_id,
            expected_impact=comp_input.expected_impact,
        )
        db.add(mc)
    
    db.commit()
    db.refresh(window)
    
    log_action(db, user.user_id, "create", "maintenance", str(window.id), None, {
        "title": data.title,
        "start_at": data.start_at.isoformat(),
        "end_at": data.end_at.isoformat(),
    })
    
    return get_maintenance(window.id, db)


@router.patch("/{maintenance_id}", response_model=MaintenanceResponse)
def update_maintenance(
    maintenance_id: UUID,
    data: MaintenanceUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Update a maintenance window."""
    window = db.query(MaintenanceWindow).filter(MaintenanceWindow.id == maintenance_id).first()
    if not window:
        raise HTTPException(status_code=404, detail="Maintenance window not found")
    
    if window.status in (MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELED):
        raise HTTPException(status_code=400, detail="Cannot update completed/canceled maintenance")
    
    before = {k: getattr(window, k) for k in data.model_dump(exclude_unset=True).keys()}
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(window, key, value)
    
    db.commit()
    db.refresh(window)
    
    log_action(db, user.user_id, "update", "maintenance", str(window.id), before, data.model_dump(exclude_unset=True))
    
    return window


@router.post("/{maintenance_id}/start", response_model=MaintenanceResponse)
async def start_maintenance(
    maintenance_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Start a scheduled maintenance window."""
    window = db.query(MaintenanceWindow).filter(MaintenanceWindow.id == maintenance_id).first()
    if not window:
        raise HTTPException(status_code=404, detail="Maintenance window not found")
    
    if window.status != MaintenanceStatus.SCHEDULED:
        raise HTTPException(status_code=400, detail="Only scheduled maintenance can be started")
    
    window.status = MaintenanceStatus.IN_PROGRESS
    db.commit()
    db.refresh(window)
    
    log_action(db, user.user_id, "start", "maintenance", str(window.id), None, None)
    
    return window


@router.post("/{maintenance_id}/complete", response_model=MaintenanceResponse)
async def complete_maintenance(
    maintenance_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Complete a maintenance window."""
    window = db.query(MaintenanceWindow).filter(MaintenanceWindow.id == maintenance_id).first()
    if not window:
        raise HTTPException(status_code=404, detail="Maintenance window not found")
    
    if window.status != MaintenanceStatus.IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Only in-progress maintenance can be completed")
    
    window.status = MaintenanceStatus.COMPLETED
    db.commit()
    db.refresh(window)
    
    log_action(db, user.user_id, "complete", "maintenance", str(window.id), None, None)
    
    return window


@router.post("/{maintenance_id}/cancel", response_model=MaintenanceResponse)
def cancel_maintenance(
    maintenance_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Cancel a maintenance window."""
    window = db.query(MaintenanceWindow).filter(MaintenanceWindow.id == maintenance_id).first()
    if not window:
        raise HTTPException(status_code=404, detail="Maintenance window not found")
    
    if window.status in (MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELED):
        raise HTTPException(status_code=400, detail="Maintenance already completed or canceled")
    
    window.status = MaintenanceStatus.CANCELED
    db.commit()
    db.refresh(window)
    
    log_action(db, user.user_id, "cancel", "maintenance", str(window.id), None, None)
    
    return window
