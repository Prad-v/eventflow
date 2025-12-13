"""Initial schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2024-12-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Component Group table
    op.create_table(
        'component_group',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('owner_team', sa.String(255), nullable=True),
        sa.Column('display_order', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Component table
    op.create_table(
        'component',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('component_group.id'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('tier', sa.Integer, default=2),
        sa.Column('service_owner', sa.String(255), nullable=True),
        sa.Column('tags', postgresql.JSONB, default={}),
        sa.Column('display_order', sa.Integer, default=0),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_component_tags', 'component', ['tags'], postgresql_using='gin', postgresql_ops={'tags': 'jsonb_path_ops'})
    
    # Incident table
    op.create_table(
        'incident',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('severity', sa.Enum('critical', 'major', 'minor', 'info', name='severity'), nullable=False),
        sa.Column('status', sa.Enum('investigating', 'identified', 'monitoring', 'resolved', name='incidentstatus'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_incident_status_started', 'incident', ['status', 'started_at'])
    
    # Incident Update table
    op.create_table(
        'incident_update',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('incident.id'), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('status_snapshot', sa.Enum('investigating', 'identified', 'monitoring', 'resolved', name='incidentstatus', create_type=False), nullable=False),
        sa.Column('created_by', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_incident_update_incident_created', 'incident_update', ['incident_id', 'created_at'])
    
    # Incident Component junction table
    op.create_table(
        'incident_component',
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('incident.id'), primary_key=True),
        sa.Column('component_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('component.id'), primary_key=True),
        sa.Column('impact', sa.Enum('degraded', 'outage', name='impact'), nullable=False),
    )
    op.create_index('idx_incident_component_component', 'incident_component', ['component_id', 'incident_id'])
    
    # Maintenance Window table
    op.create_table(
        'maintenance_window',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('status', sa.Enum('scheduled', 'in_progress', 'completed', 'canceled', name='maintenancestatus'), nullable=False),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Maintenance Component junction table
    op.create_table(
        'maintenance_component',
        sa.Column('maintenance_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('maintenance_window.id'), primary_key=True),
        sa.Column('component_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('component.id'), primary_key=True),
        sa.Column('expected_impact', sa.Enum('degraded', 'outage', name='impact', create_type=False), nullable=False),
    )
    
    # Audit Log table
    op.create_table(
        'audit_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('actor', sa.String(255), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=False),
        sa.Column('entity_id', sa.String(255), nullable=False),
        sa.Column('before_state', postgresql.JSONB, nullable=True),
        sa.Column('after_state', postgresql.JSONB, nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_audit_log_entity', 'audit_log', ['entity_type', 'entity_id'])
    op.create_index('idx_audit_log_timestamp', 'audit_log', ['timestamp'])


def downgrade() -> None:
    op.drop_table('audit_log')
    op.drop_table('maintenance_component')
    op.drop_table('maintenance_window')
    op.drop_table('incident_component')
    op.drop_table('incident_update')
    op.drop_table('incident')
    op.drop_table('component')
    op.drop_table('component_group')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS severity')
    op.execute('DROP TYPE IF EXISTS incidentstatus')
    op.execute('DROP TYPE IF EXISTS maintenancestatus')
    op.execute('DROP TYPE IF EXISTS impact')
