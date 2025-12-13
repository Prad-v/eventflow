"""Incident API routes."""
from typing import Annotated, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import CurrentUser, Role, get_current_user, require_role
from app.models.models import (
    Incident, IncidentUpdate, IncidentComponent, Component,
    IncidentStatus, Severity
)
from app.schemas.schemas import (
    IncidentCreate, IncidentResponse, IncidentDetailResponse, 
    IncidentListResponse, IncidentUpdateCreate, IncidentUpdateResponse,
    IncidentResolveRequest,
)
from app.services.audit import log_action


router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    db: Annotated[Session, Depends(get_db)],
    status_filter: Optional[IncidentStatus] = Query(None, alias="status"),
    severity: Optional[Severity] = Query(None),
    component_id: Optional[UUID] = Query(None),
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List incidents with filtering and pagination."""
    query = db.query(Incident)
    
    if status_filter:
        query = query.filter(Incident.status == status_filter)
    if severity:
        query = query.filter(Incident.severity == severity)
    if component_id:
        query = query.join(IncidentComponent).filter(IncidentComponent.component_id == component_id)
    if from_date:
        query = query.filter(Incident.started_at >= from_date)
    if to_date:
        query = query.filter(Incident.started_at <= to_date)
    
    total = query.count()
    incidents = query.order_by(Incident.started_at.desc())\
                     .offset((page - 1) * page_size)\
                     .limit(page_size)\
                     .all()
    
    return IncidentListResponse(
        items=incidents,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{incident_id}", response_model=IncidentDetailResponse)
async def get_incident(
    incident_id: UUID,
    db: Annotated[Session, Depends(get_db)],
):
    """Get a single incident with all updates and components."""
    incident = db.query(Incident)\
        .options(
            joinedload(Incident.updates),
            joinedload(Incident.incident_components).joinedload(IncidentComponent.component)
        )\
        .filter(Incident.id == incident_id)\
        .first()
    
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return IncidentDetailResponse(
        id=incident.id,
        title=incident.title,
        severity=incident.severity,
        status=incident.status,
        started_at=incident.started_at,
        resolved_at=incident.resolved_at,
        created_by=incident.created_by,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        updates=[IncidentUpdateResponse.model_validate(u) for u in incident.updates],
        components=[
            {
                "component_id": ic.component_id,
                "impact": ic.impact,
                "component": ic.component,
            }
            for ic in incident.incident_components
        ],
    )


@router.post("", response_model=IncidentDetailResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    data: IncidentCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Create a new incident."""
    # Validate components exist
    component_ids = [c.component_id for c in data.components]
    if component_ids:
        existing = db.query(Component.id).filter(Component.id.in_(component_ids)).all()
        existing_ids = {c.id for c in existing}
        missing = set(component_ids) - existing_ids
        if missing:
            raise HTTPException(status_code=400, detail=f"Components not found: {missing}")
    
    # Create incident
    incident = Incident(
        title=data.title,
        severity=data.severity,
        status=IncidentStatus.INVESTIGATING,
        created_by=user.user_id,
    )
    db.add(incident)
    db.flush()
    
    # Create initial update
    initial_update = IncidentUpdate(
        incident_id=incident.id,
        message=data.message,
        status_snapshot=IncidentStatus.INVESTIGATING,
        created_by=user.user_id,
    )
    db.add(initial_update)
    
    # Associate components
    for comp_input in data.components:
        ic = IncidentComponent(
            incident_id=incident.id,
            component_id=comp_input.component_id,
            impact=comp_input.impact,
        )
        db.add(ic)
    
    db.commit()
    db.refresh(incident)
    
    log_action(db, user.user_id, "create", "incident", str(incident.id), None, {
        "title": data.title,
        "severity": data.severity.value,
        "components": [str(c.component_id) for c in data.components],
    })
    
    return get_incident(incident.id, db)


@router.post("/{incident_id}/updates", response_model=IncidentUpdateResponse, status_code=status.HTTP_201_CREATED)
def add_incident_update(
    incident_id: UUID,
    data: IncidentUpdateCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Add an update to an incident."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    if incident.status == IncidentStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Cannot update resolved incident")
    
    # Update incident status if provided
    new_status = data.status or incident.status
    if data.status:
        incident.status = data.status
    
    # Create update entry
    update = IncidentUpdate(
        incident_id=incident_id,
        message=data.message,
        status_snapshot=new_status,
        created_by=user.user_id,
    )
    db.add(update)
    db.commit()
    db.refresh(update)
    
    log_action(db, user.user_id, "update", "incident", str(incident_id), None, {
        "message": data.message,
        "status": new_status.value,
    })
    
    return update


@router.post("/{incident_id}/resolve", response_model=IncidentDetailResponse)
def resolve_incident(
    incident_id: UUID,
    data: IncidentResolveRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Resolve an incident."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    if incident.status == IncidentStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="Incident already resolved")
    
    # Update incident
    incident.status = IncidentStatus.RESOLVED
    incident.resolved_at = datetime.utcnow()
    
    # Create resolution update
    update = IncidentUpdate(
        incident_id=incident_id,
        message=data.message,
        status_snapshot=IncidentStatus.RESOLVED,
        created_by=user.user_id,
    )
    db.add(update)
    db.commit()
    
    log_action(db, user.user_id, "resolve", "incident", str(incident_id), None, {
        "message": data.message,
    })
    
    return get_incident(incident_id, db)
