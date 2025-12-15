"""Add local admin users and OIDC settings

Revision ID: 002_local_admin_settings
Revises: 001_initial_schema
Create Date: 2024-12-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002_local_admin_settings'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Local User table for breakglass admin access
    op.create_table(
        'local_user',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('username', sa.String(100), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean, default=True, nullable=False),
        sa.Column('is_superadmin', sa.Boolean, default=False, nullable=False),
        sa.Column('must_change_password', sa.Boolean, default=False, nullable=False),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_local_user_username', 'local_user', ['username'])
    
    # Create default admin user (password: admin, must change on first login)
    import uuid
    import bcrypt
    # Hash the password 'admin' - using bcrypt directly
    admin_password_hash = bcrypt.hashpw(b"admin", bcrypt.gensalt()).decode('utf-8')
    
    op.execute(
        f"""
        INSERT INTO local_user (id, username, password_hash, display_name, is_active, is_superadmin, must_change_password)
        VALUES ('{uuid.uuid4()}', 'admin', '{admin_password_hash}', 'Administrator', true, true, true)
        ON CONFLICT (username) DO NOTHING
        """
    )

    # App Settings table (key-value store for config)
    op.create_table(
        'app_settings',
        sa.Column('key', sa.String(100), primary_key=True),
        sa.Column('value', postgresql.JSONB, nullable=True),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('updated_by', sa.String(255), nullable=True),
    )

    # OIDC Configuration table
    op.create_table(
        'oidc_config',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('provider_name', sa.String(100), nullable=False, default='logto'),
        sa.Column('enabled', sa.Boolean, default=False, nullable=False),
        sa.Column('issuer_url', sa.String(500), nullable=True),
        sa.Column('client_id', sa.String(255), nullable=True),
        sa.Column('client_secret_encrypted', sa.Text, nullable=True),  # Encrypted at rest
        sa.Column('audience', sa.String(500), nullable=True),
        sa.Column('scopes', postgresql.ARRAY(sa.String), default=['openid', 'profile', 'email']),
        sa.Column('redirect_uri', sa.String(500), nullable=True),
        sa.Column('admin_endpoint', sa.String(500), nullable=True),  # Logto admin console URL
        
        # M2M credentials for Logto Management API
        sa.Column('m2m_app_id', sa.String(255), nullable=True),
        sa.Column('m2m_app_secret_encrypted', sa.Text, nullable=True),
        
        # Sync state
        sa.Column('is_provisioned', sa.Boolean, default=False),
        sa.Column('provisioned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('oidc_config')
    op.drop_table('app_settings')
    op.drop_index('idx_local_user_username')
    op.drop_table('local_user')
