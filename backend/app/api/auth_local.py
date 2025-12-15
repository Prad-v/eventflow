"""Local authentication API endpoints for breakglass admin access."""
from typing import Annotated
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import Role, CurrentUser, require_role
from app.models.models import LocalUser
from app.services.local_auth import (
    authenticate_user,
    create_local_token,
    create_local_user,
    update_local_user_password,
    hash_password,
)
from app.services.audit import log_action

router = APIRouter(prefix="/auth/local", tags=["Local Auth"])


# ============================================================================
# Schemas
# ============================================================================

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)


class LocalUserResponse(BaseModel):
    id: UUID
    username: str
    email: str | None
    display_name: str | None
    is_active: bool
    is_superadmin: bool
    must_change_password: bool = False
    last_login: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: LocalUserResponse


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class LocalUserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=8)
    email: str | None = None
    display_name: str | None = None
    is_superadmin: bool = False


class LocalUserUpdate(BaseModel):
    email: str | None = None
    display_name: str | None = None
    is_active: bool | None = None
    is_superadmin: bool | None = None


class PasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=8)


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/login", response_model=LoginResponse)
async def login(
    data: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Authenticate with local username and password.
    
    This endpoint is for breakglass admin access when OIDC is unavailable.
    """
    user = authenticate_user(db, data.username, data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = create_local_token(user)
    
    return LoginResponse(
        access_token=token,
        user=LocalUserResponse.model_validate(user),
    )


@router.get("/me", response_model=LocalUserResponse)
async def get_current_local_user(
    user: Annotated[CurrentUser, Depends(require_role(Role.VIEWER))],
    db: Annotated[Session, Depends(get_db)],
):
    """Get current user info (works for both local and OIDC users)."""
    # Try to find local user
    local_user = db.query(LocalUser).filter(LocalUser.id == UUID(user.user_id) if len(user.user_id) == 36 else False).first()
    if local_user:
        return LocalUserResponse.model_validate(local_user)
    
    # Return constructed response for OIDC users
    return LocalUserResponse(
        id=UUID(user.user_id) if len(user.user_id) == 36 else UUID(int=0),
        username=user.email.split("@")[0] if user.email else "oidc_user",
        email=user.email,
        display_name=user.name,
        is_active=True,
        is_superadmin=Role.ADMIN in user.roles,
        must_change_password=False,
        last_login=None,
        created_at=datetime.utcnow(),
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_own_password(
    data: ChangePasswordRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.VIEWER))],
):
    """
    Change the current user's password.
    
    This endpoint allows users to change their own password, especially
    after first login when must_change_password is set.
    """
    from app.services.local_auth import verify_password
    
    # Only works for local users
    if user.auth_type != "local":
        raise HTTPException(status_code=400, detail="Password change only available for local users")
    
    local_user = db.query(LocalUser).filter(LocalUser.id == UUID(user.user_id)).first()
    if not local_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(data.current_password, local_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password and clear must_change_password flag
    update_local_user_password(db, local_user, data.new_password)
    local_user.must_change_password = False
    db.commit()
    
    log_action(db, user.user_id, "change_password", "local_user", str(local_user.id), None, None)


# ============================================================================
# Admin User Management (requires ADMIN role)
# ============================================================================

admin_router = APIRouter(prefix="/admin/users", tags=["Admin Users"])


@admin_router.get("", response_model=list[LocalUserResponse])
async def list_local_users(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """List all local admin users."""
    users = db.query(LocalUser).order_by(LocalUser.username).all()
    return users


@admin_router.post("", response_model=LocalUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: LocalUserCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Create a new local admin user."""
    # Check if username already exists
    existing = db.query(LocalUser).filter(LocalUser.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    new_user = create_local_user(
        db=db,
        username=data.username,
        password=data.password,
        email=data.email,
        display_name=data.display_name,
        is_superadmin=data.is_superadmin,
    )
    
    log_action(db, user.user_id, "create", "local_user", str(new_user.id), None, {"username": data.username})
    
    return new_user


@admin_router.get("/{user_id}", response_model=LocalUserResponse)
async def get_user(
    user_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Get a local user by ID."""
    local_user = db.query(LocalUser).filter(LocalUser.id == user_id).first()
    if not local_user:
        raise HTTPException(status_code=404, detail="User not found")
    return local_user


@admin_router.patch("/{user_id}", response_model=LocalUserResponse)
async def update_user(
    user_id: UUID,
    data: LocalUserUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Update a local user."""
    local_user = db.query(LocalUser).filter(LocalUser.id == user_id).first()
    if not local_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    before = {k: getattr(local_user, k) for k in data.model_dump(exclude_unset=True).keys()}
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(local_user, key, value)
    
    db.commit()
    db.refresh(local_user)
    
    log_action(db, user.user_id, "update", "local_user", str(user_id), before, data.model_dump(exclude_unset=True))
    
    return local_user


@admin_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Delete a local user."""
    local_user = db.query(LocalUser).filter(LocalUser.id == user_id).first()
    if not local_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if str(user_id) == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    log_action(db, user.user_id, "delete", "local_user", str(user_id), {"username": local_user.username}, None)
    
    db.delete(local_user)
    db.commit()


@admin_router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_user_password(
    user_id: UUID,
    data: PasswordResetRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Reset a local user's password."""
    local_user = db.query(LocalUser).filter(LocalUser.id == user_id).first()
    if not local_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_local_user_password(db, local_user, data.new_password)
    
    log_action(db, user.user_id, "reset_password", "local_user", str(user_id), None, None)
