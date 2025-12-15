"""SQLAlchemy ORM models for status page entities."""
import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Column, String, Text, Integer, Boolean, DateTime, ForeignKey,
    Enum as SQLEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import relationship, Mapped, mapped_column

from app.core.database import Base


class Severity(str, enum.Enum):
    """Incident severity levels."""
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    INFO = "info"


class IncidentStatus(str, enum.Enum):
    """Incident lifecycle status."""
    INVESTIGATING = "investigating"
    IDENTIFIED = "identified"
    MONITORING = "monitoring"
    RESOLVED = "resolved"


class MaintenanceStatus(str, enum.Enum):
    """Maintenance window status."""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELED = "canceled"


class ComponentStatus(str, enum.Enum):
    """Component operational status."""
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    PARTIAL_OUTAGE = "partial_outage"
    MAJOR_OUTAGE = "major_outage"
    MAINTENANCE = "maintenance"


class Impact(str, enum.Enum):
    """Impact level on component."""
    DEGRADED = "degraded"
    OUTAGE = "outage"


# ============================================================================
# Component Group
# ============================================================================
class ComponentGroup(Base):
    """Logical grouping of components."""
    __tablename__ = "component_group"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_team: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    components: Mapped[list["Component"]] = relationship("Component", back_populates="group", cascade="all, delete-orphan")


# ============================================================================
# Component
# ============================================================================
class Component(Base):
    """Individual service or component being monitored."""
    __tablename__ = "component"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("component_group.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tier: Mapped[int] = mapped_column(Integer, default=2)  # 0=critical, 1=high, 2=medium, 3=low
    service_owner: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tags: Mapped[dict] = mapped_column(JSONB, default=dict)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    group: Mapped[Optional["ComponentGroup"]] = relationship("ComponentGroup", back_populates="components")
    incident_components: Mapped[list["IncidentComponent"]] = relationship("IncidentComponent", back_populates="component")
    maintenance_components: Mapped[list["MaintenanceComponent"]] = relationship("MaintenanceComponent", back_populates="component")
    
    __table_args__ = (
        Index("idx_component_tags", "tags", postgresql_using="gin"),
    )


# ============================================================================
# Incident
# ============================================================================
class Incident(Base):
    """Service incident or outage."""
    __tablename__ = "incident"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    severity: Mapped[Severity] = mapped_column(SQLEnum(Severity, values_callable=lambda x: [e.value for e in x]), nullable=False, default=Severity.MINOR)
    status: Mapped[IncidentStatus] = mapped_column(SQLEnum(IncidentStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=IncidentStatus.INVESTIGATING)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(50), default="manual")  # manual, pagerduty, opsgenie
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    updates: Mapped[list["IncidentUpdate"]] = relationship("IncidentUpdate", back_populates="incident", cascade="all, delete-orphan", order_by="IncidentUpdate.created_at.desc()")
    incident_components: Mapped[list["IncidentComponent"]] = relationship("IncidentComponent", back_populates="incident", cascade="all, delete-orphan")
    external_incidents: Mapped[list["ExternalIncident"]] = relationship("ExternalIncident", back_populates="incident", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_incident_status_started", "status", "started_at"),
    )


class IncidentUpdate(Base):
    """Timeline update for an incident."""
    __tablename__ = "incident_update"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("incident.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status_snapshot: Mapped[IncidentStatus] = mapped_column(SQLEnum(IncidentStatus, values_callable=lambda x: [e.value for e in x]), nullable=False)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationships
    incident: Mapped["Incident"] = relationship("Incident", back_populates="updates")
    
    __table_args__ = (
        Index("idx_incident_update_incident_created", "incident_id", "created_at"),
    )


class IncidentComponent(Base):
    """Junction table for incidents and affected components."""
    __tablename__ = "incident_component"
    
    incident_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("incident.id"), primary_key=True)
    component_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("component.id"), primary_key=True)
    impact: Mapped[Impact] = mapped_column(SQLEnum(Impact, values_callable=lambda x: [e.value for e in x]), nullable=False, default=Impact.DEGRADED)
    
    # Relationships
    incident: Mapped["Incident"] = relationship("Incident", back_populates="incident_components")
    component: Mapped["Component"] = relationship("Component", back_populates="incident_components")
    
    __table_args__ = (
        Index("idx_incident_component_component", "component_id", "incident_id"),
    )


# ============================================================================
# Maintenance
# ============================================================================
class MaintenanceWindow(Base):
    """Scheduled maintenance window."""
    __tablename__ = "maintenance_window"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[MaintenanceStatus] = mapped_column(SQLEnum(MaintenanceStatus, values_callable=lambda x: [e.value for e in x]), nullable=False, default=MaintenanceStatus.SCHEDULED)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    maintenance_components: Mapped[list["MaintenanceComponent"]] = relationship("MaintenanceComponent", back_populates="maintenance", cascade="all, delete-orphan")


class MaintenanceComponent(Base):
    """Junction table for maintenance windows and affected components."""
    __tablename__ = "maintenance_component"
    
    maintenance_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("maintenance_window.id"), primary_key=True)
    component_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("component.id"), primary_key=True)
    expected_impact: Mapped[Impact] = mapped_column(SQLEnum(Impact, values_callable=lambda x: [e.value for e in x]), nullable=False, default=Impact.DEGRADED)
    
    # Relationships
    maintenance: Mapped["MaintenanceWindow"] = relationship("MaintenanceWindow", back_populates="maintenance_components")
    component: Mapped["Component"] = relationship("Component", back_populates="maintenance_components")


# ============================================================================
# Audit Log
# ============================================================================
class AuditLog(Base):
    """Immutable audit trail of all changes."""
    __tablename__ = "audit_log"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # create, update, delete
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # component, incident, etc.
    entity_id: Mapped[str] = mapped_column(String(255), nullable=False)
    before_state: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    __table_args__ = (
        Index("idx_audit_log_entity", "entity_type", "entity_id"),
        Index("idx_audit_log_timestamp", "timestamp"),
    )


# ============================================================================
# Local Admin Users (Breakglass)
# ============================================================================
class LocalUser(Base):
    """Local admin user for breakglass access when OIDC is unavailable."""
    __tablename__ = "local_user"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)



# ============================================================================
# App Settings
# ============================================================================
class AppSettings(Base):
    """Key-value store for application configuration."""
    __tablename__ = "app_settings"
    
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


# ============================================================================
# OIDC Configuration
# ============================================================================
class OIDCConfig(Base):
    """OIDC provider configuration for authentication."""
    __tablename__ = "oidc_config"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_name: Mapped[str] = mapped_column(String(100), default="logto")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    issuer_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    client_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    client_secret_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audience: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    scopes: Mapped[Optional[list]] = mapped_column(postgresql.ARRAY(String), default=['openid', 'profile', 'email'])
    redirect_uri: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    admin_endpoint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # M2M credentials for Logto Management API
    m2m_app_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    m2m_app_secret_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Sync state
    is_provisioned: Mapped[bool] = mapped_column(Boolean, default=False)
    provisioned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# Datasource Integrations (PagerDuty, etc.)
# ============================================================================
class Datasource(Base):
    """External datasource integration (PagerDuty, OpsGenie, etc.)."""
    __tablename__ = "datasource"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pagerduty, opsgenie
    config_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Encrypted JSON
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_status: Mapped[Optional[str]] = mapped_column(String(50), default="idle")  # idle, syncing, error, success
    sync_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sync_interval_seconds: Mapped[int] = mapped_column(Integer, default=60)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    external_incidents: Mapped[list["ExternalIncident"]] = relationship("ExternalIncident", back_populates="datasource", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_datasource_provider", "provider_type"),
        Index("idx_datasource_enabled", "enabled"),
    )


class ExternalIncident(Base):
    """Links external incidents to internal incidents."""
    __tablename__ = "external_incident"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    datasource_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("datasource.id", ondelete="CASCADE"), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)  # PagerDuty incident ID
    incident_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("incident.id", ondelete="CASCADE"), nullable=True)
    external_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # Full external incident data
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    
    # Relationships
    datasource: Mapped["Datasource"] = relationship("Datasource", back_populates="external_incidents")
    incident: Mapped[Optional["Incident"]] = relationship("Incident", back_populates="external_incidents")
    
    __table_args__ = (
        Index("idx_external_incident_datasource", "datasource_id"),
        Index("idx_external_incident_external_id", "datasource_id", "external_id", unique=True),
    )
