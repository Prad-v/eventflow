"""Status overview API routes."""
from typing import Annotated
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    Component, ComponentGroup, Incident, MaintenanceWindow,
    IncidentComponent, MaintenanceComponent,
    IncidentStatus, MaintenanceStatus, ComponentStatus, Impact
)
from app.schemas.schemas import (
    StatusOverviewResponse, GroupStatusInfo, ComponentStatusInfo,
    ActiveIncidentSummary, MaintenanceResponse,
)


router = APIRouter(prefix="/status", tags=["Status"])


def compute_component_status(
    component_id,
    active_incidents: list,
    active_maintenance: list,
) -> ComponentStatus:
    """Compute the current status of a component based on incidents and maintenance."""
    # Check for active incidents affecting this component
    for incident in active_incidents:
        for ic in incident.incident_components:
            if ic.component_id == component_id:
                if ic.impact == Impact.OUTAGE:
                    return ComponentStatus.MAJOR_OUTAGE
                elif ic.impact == Impact.DEGRADED:
                    return ComponentStatus.DEGRADED
    
    # Check for active maintenance affecting this component
    for maint in active_maintenance:
        for mc in maint.maintenance_components:
            if mc.component_id == component_id:
                return ComponentStatus.MAINTENANCE
    
    return ComponentStatus.OPERATIONAL


def compute_global_status(groups: list[GroupStatusInfo]) -> ComponentStatus:
    """Compute global status based on all component statuses."""
    has_outage = False
    has_degraded = False
    has_partial = False
    
    for group in groups:
        for component in group.components:
            if component.status == ComponentStatus.MAJOR_OUTAGE:
                if component.tier <= 1:  # Tier-0 or Tier-1
                    return ComponentStatus.MAJOR_OUTAGE
                has_outage = True
            elif component.status == ComponentStatus.PARTIAL_OUTAGE:
                has_partial = True
            elif component.status == ComponentStatus.DEGRADED:
                has_degraded = True
    
    if has_outage:
        return ComponentStatus.PARTIAL_OUTAGE
    if has_partial or has_degraded:
        return ComponentStatus.DEGRADED
    return ComponentStatus.OPERATIONAL


@router.get("/overview", response_model=StatusOverviewResponse)
def get_status_overview(
    db: Annotated[Session, Depends(get_db)],
):
    """Get the global status overview with all components and active incidents."""
    # Fetch active incidents (not resolved)
    active_incidents = db.query(Incident)\
        .filter(Incident.status != IncidentStatus.RESOLVED)\
        .order_by(Incident.started_at.desc())\
        .all()
    
    # Fetch active/upcoming maintenance
    now = datetime.utcnow()
    active_maintenance = db.query(MaintenanceWindow)\
        .filter(MaintenanceWindow.status == MaintenanceStatus.IN_PROGRESS)\
        .all()
    
    # Fetch upcoming maintenance (next 7 days)
    upcoming_maintenance = db.query(MaintenanceWindow)\
        .filter(
            MaintenanceWindow.status == MaintenanceStatus.SCHEDULED,
            MaintenanceWindow.start_at <= now + timedelta(days=7),
            MaintenanceWindow.start_at >= now,
        )\
        .order_by(MaintenanceWindow.start_at)\
        .limit(5)\
        .all()
    
    # Fetch all groups with components
    groups = db.query(ComponentGroup)\
        .order_by(ComponentGroup.display_order, ComponentGroup.name)\
        .all()
    
    # Fetch ungrouped components
    ungrouped_components = db.query(Component)\
        .filter(Component.group_id.is_(None), Component.is_active == True)\
        .order_by(Component.display_order, Component.name)\
        .all()
    
    # Build group status info
    group_statuses = []
    for group in groups:
        active_components = [c for c in group.components if c.is_active]
        component_statuses = [
            ComponentStatusInfo(
                id=c.id,
                name=c.name,
                status=compute_component_status(c.id, active_incidents, active_maintenance),
                tier=c.tier,
            )
            for c in active_components
        ]
        
        if component_statuses:
            group_statuses.append(GroupStatusInfo(
                id=group.id,
                name=group.name,
                components=component_statuses,
            ))
    
    # Add ungrouped components as a pseudo-group
    if ungrouped_components:
        component_statuses = [
            ComponentStatusInfo(
                id=c.id,
                name=c.name,
                status=compute_component_status(c.id, active_incidents, active_maintenance),
                tier=c.tier,
            )
            for c in ungrouped_components
        ]
        group_statuses.append(GroupStatusInfo(
            id=None,
            name="Other Services",
            components=component_statuses,
        ))
    
    # Build active incident summaries
    incident_summaries = [
        ActiveIncidentSummary(
            id=inc.id,
            title=inc.title,
            severity=inc.severity,
            status=inc.status,
            started_at=inc.started_at,
            affected_components=len(inc.incident_components),
        )
        for inc in active_incidents
    ]
    
    # Compute global status
    global_status = compute_global_status(group_statuses)
    
    return StatusOverviewResponse(
        global_status=global_status,
        groups=group_statuses,
        active_incidents=incident_summaries,
        upcoming_maintenance=[MaintenanceResponse.model_validate(m) for m in upcoming_maintenance],
        last_updated=now,
    )
