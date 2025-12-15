"""Add datasource integrations and external incidents

Revision ID: 003_datasource_integration
Revises: 002_local_admin_settings
Create Date: 2024-12-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_datasource_integration'
down_revision: Union[str, None] = '002_local_admin_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Datasource table - stores integration configurations
    op.create_table(
        'datasource',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('provider_type', sa.String(50), nullable=False),  # 'pagerduty', 'opsgenie', etc.
        sa.Column('config_encrypted', sa.Text, nullable=True),  # Encrypted JSON config
        sa.Column('enabled', sa.Boolean, default=False, nullable=False),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sync_status', sa.String(50), default='idle'),  # idle, syncing, error, success
        sa.Column('sync_error', sa.Text, nullable=True),
        sa.Column('sync_interval_seconds', sa.Integer, default=60),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_datasource_provider', 'datasource', ['provider_type'])
    op.create_index('idx_datasource_enabled', 'datasource', ['enabled'])
    
    # External Incident table - links external incidents to internal ones
    op.create_table(
        'external_incident',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('datasource_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('datasource.id', ondelete='CASCADE'), nullable=False),
        sa.Column('external_id', sa.String(255), nullable=False),  # PagerDuty incident ID
        sa.Column('incident_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('incident.id', ondelete='CASCADE'), nullable=True),
        sa.Column('external_url', sa.String(500), nullable=True),
        sa.Column('raw_data', postgresql.JSONB, nullable=True),  # Full PD incident data
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('idx_external_incident_datasource', 'external_incident', ['datasource_id'])
    op.create_index('idx_external_incident_external_id', 'external_incident', ['datasource_id', 'external_id'], unique=True)
    
    # Add source field to incident table to identify origin
    op.add_column('incident', sa.Column('source', sa.String(50), default='manual', nullable=True))


def downgrade() -> None:
    op.drop_column('incident', 'source')
    op.drop_index('idx_external_incident_external_id')
    op.drop_index('idx_external_incident_datasource')
    op.drop_table('external_incident')
    op.drop_index('idx_datasource_enabled')
    op.drop_index('idx_datasource_provider')
    op.drop_table('datasource')
