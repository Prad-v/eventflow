"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict

from app.models.models import Severity, IncidentStatus, MaintenanceStatus, ComponentStatus, Impact


# ============================================================================
# Pagination
# ============================================================================
class PaginationParams(BaseModel):
    """Common pagination parameters."""
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    """Base paginated response."""
    page: int
    page_size: int
    total: int


# ============================================================================
# Component Group Schemas
# ============================================================================
class ComponentGroupBase(BaseModel):
    """Base component group fields."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    owner_team: Optional[str] = Field(None, max_length=255)
    display_order: int = 0


class ComponentGroupCreate(ComponentGroupBase):
    """Schema for creating a component group."""
    pass


class ComponentGroupUpdate(BaseModel):
    """Schema for updating a component group."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    owner_team: Optional[str] = Field(None, max_length=255)
    display_order: Optional[int] = None


class ComponentGroupResponse(ComponentGroupBase):
    """Response schema for component group."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    created_at: datetime
    updated_at: datetime


# ============================================================================
# Component Schemas
# ============================================================================
class ComponentBase(BaseModel):
    """Base component fields."""
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    tier: int = Field(default=2, ge=0, le=3)
    service_owner: Optional[str] = Field(None, max_length=255)
    tags: dict = Field(default_factory=dict)
    display_order: int = 0
    is_active: bool = True


class ComponentCreate(ComponentBase):
    """Schema for creating a component."""
    group_id: Optional[UUID] = None


class ComponentUpdate(BaseModel):
    """Schema for updating a component."""
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    group_id: Optional[UUID] = None
    tier: Optional[int] = Field(None, ge=0, le=3)
    service_owner: Optional[str] = Field(None, max_length=255)
    tags: Optional[dict] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class ComponentResponse(ComponentBase):
    """Response schema for component."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    group_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    current_status: ComponentStatus = ComponentStatus.OPERATIONAL


class ComponentWithGroupResponse(ComponentResponse):
    """Response with nested group info."""
    group: Optional[ComponentGroupResponse] = None


class ComponentListResponse(PaginatedResponse):
    """Paginated list of components."""
    items: list[ComponentResponse]


# ============================================================================
# Incident Schemas
# ============================================================================
class IncidentComponentInput(BaseModel):
    """Input for associating component with incident."""
    component_id: UUID
    impact: Impact = Impact.DEGRADED


class IncidentComponentResponse(BaseModel):
    """Response for incident-component association."""
    model_config = ConfigDict(from_attributes=True)
    
    component_id: UUID
    impact: Impact
    component: Optional[ComponentResponse] = None


class IncidentUpdateCreate(BaseModel):
    """Schema for creating an incident update."""
    message: str = Field(..., min_length=1)
    status: Optional[IncidentStatus] = None


class IncidentUpdateResponse(BaseModel):
    """Response schema for incident update."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    message: str
    status_snapshot: IncidentStatus
    created_by: str
    created_at: datetime


class IncidentBase(BaseModel):
    """Base incident fields."""
    title: str = Field(..., max_length=500)
    severity: Severity = Severity.MINOR


class IncidentCreate(IncidentBase):
    """Schema for creating an incident."""
    message: str = Field(..., min_length=1, description="Initial update message")
    components: list[IncidentComponentInput] = Field(default_factory=list)


class IncidentResponse(IncidentBase):
    """Response schema for incident."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    status: IncidentStatus
    started_at: datetime
    resolved_at: Optional[datetime] = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class IncidentDetailResponse(IncidentResponse):
    """Detailed incident response with updates and components."""
    updates: list[IncidentUpdateResponse] = []
    components: list[IncidentComponentResponse] = []


class IncidentListResponse(PaginatedResponse):
    """Paginated list of incidents."""
    items: list[IncidentResponse]


class IncidentResolveRequest(BaseModel):
    """Request to resolve an incident."""
    message: str = Field(..., min_length=1, description="Resolution message")


# ============================================================================
# Maintenance Schemas
# ============================================================================
class MaintenanceComponentInput(BaseModel):
    """Input for associating component with maintenance."""
    component_id: UUID
    expected_impact: Impact = Impact.DEGRADED


class MaintenanceComponentResponse(BaseModel):
    """Response for maintenance-component association."""
    model_config = ConfigDict(from_attributes=True)
    
    component_id: UUID
    expected_impact: Impact
    component: Optional[ComponentResponse] = None


class MaintenanceBase(BaseModel):
    """Base maintenance fields."""
    title: str = Field(..., max_length=500)
    description: Optional[str] = None
    start_at: datetime
    end_at: datetime


class MaintenanceCreate(MaintenanceBase):
    """Schema for creating maintenance window."""
    components: list[MaintenanceComponentInput] = Field(default_factory=list)


class MaintenanceUpdate(BaseModel):
    """Schema for updating maintenance window."""
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None


class MaintenanceResponse(MaintenanceBase):
    """Response schema for maintenance window."""
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    status: MaintenanceStatus
    created_by: str
    created_at: datetime
    updated_at: datetime


class MaintenanceDetailResponse(MaintenanceResponse):
    """Detailed maintenance response with components."""
    components: list[MaintenanceComponentResponse] = []


class MaintenanceListResponse(PaginatedResponse):
    """Paginated list of maintenance windows."""
    items: list[MaintenanceResponse]


# ============================================================================
# Status Overview Schemas
# ============================================================================
class ComponentStatusInfo(BaseModel):
    """Component status information for overview."""
    id: UUID
    name: str
    status: ComponentStatus
    tier: int


class GroupStatusInfo(BaseModel):
    """Group status information for overview."""
    id: UUID
    name: str
    components: list[ComponentStatusInfo]


class ActiveIncidentSummary(BaseModel):
    """Summary of an active incident."""
    id: UUID
    title: str
    severity: Severity
    status: IncidentStatus
    started_at: datetime
    affected_components: int


class StatusOverviewResponse(BaseModel):
    """Global status overview response."""
    global_status: ComponentStatus
    groups: list[GroupStatusInfo]
    active_incidents: list[ActiveIncidentSummary]
    upcoming_maintenance: list[MaintenanceResponse]
    last_updated: datetime


# ============================================================================
# Error Response
# ============================================================================
class ErrorDetail(BaseModel):
    """Error detail."""
    code: str
    message: str
    request_id: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: ErrorDetail
