"""Component API routes."""
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CurrentUser, Role, get_current_user, require_role
from app.models.models import Component, ComponentGroup
from app.schemas.schemas import (
    ComponentCreate, ComponentUpdate, ComponentResponse, 
    ComponentListResponse, ComponentWithGroupResponse,
    ComponentGroupCreate, ComponentGroupUpdate, ComponentGroupResponse,
)
from app.services.audit import log_action


router = APIRouter(prefix="/components", tags=["Components"])


# ============================================================================
# Component Groups
# ============================================================================
@router.get("/groups", response_model=list[ComponentGroupResponse])
def list_groups(
    db: Annotated[Session, Depends(get_db)],
):
    """List all component groups."""
    groups = db.query(ComponentGroup).order_by(ComponentGroup.display_order, ComponentGroup.name).all()
    return groups


@router.post("/groups", response_model=ComponentGroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    data: ComponentGroupCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Create a new component group."""
    group = ComponentGroup(**data.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    
    log_action(db, user.user_id, "create", "component_group", str(group.id), None, data.model_dump())
    
    return group


@router.patch("/groups/{group_id}", response_model=ComponentGroupResponse)
def update_group(
    group_id: UUID,
    data: ComponentGroupUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Update a component group."""
    group = db.query(ComponentGroup).filter(ComponentGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Component group not found")
    
    before = {k: getattr(group, k) for k in data.model_dump(exclude_unset=True).keys()}
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(group, key, value)
    
    db.commit()
    db.refresh(group)
    
    log_action(db, user.user_id, "update", "component_group", str(group.id), before, data.model_dump(exclude_unset=True))
    
    return group


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Delete a component group."""
    group = db.query(ComponentGroup).filter(ComponentGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Component group not found")
    
    log_action(db, user.user_id, "delete", "component_group", str(group.id), {"name": group.name}, None)
    
    db.delete(group)
    db.commit()


# ============================================================================
# Components
# ============================================================================
@router.get("", response_model=ComponentListResponse)
async def list_components(
    db: Annotated[Session, Depends(get_db)],
    group_id: Optional[UUID] = Query(None, description="Filter by group"),
    tag: Optional[str] = Query(None, description="Filter by tag key"),
    q: Optional[str] = Query(None, description="Search by name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """List components with filtering and pagination."""
    query = db.query(Component)
    
    if group_id:
        query = query.filter(Component.group_id == group_id)
    if tag:
        query = query.filter(Component.tags.has_key(tag))
    if q:
        query = query.filter(Component.name.ilike(f"%{q}%"))
    if is_active is not None:
        query = query.filter(Component.is_active == is_active)
    
    total = query.count()
    components = query.order_by(Component.display_order, Component.name)\
                      .offset((page - 1) * page_size)\
                      .limit(page_size)\
                      .all()
    
    return ComponentListResponse(
        items=components,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{component_id}", response_model=ComponentWithGroupResponse)
async def get_component(
    component_id: UUID,
    db: Annotated[Session, Depends(get_db)],
):
    """Get a single component by ID."""
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component


@router.post("", response_model=ComponentResponse, status_code=status.HTTP_201_CREATED)
async def create_component(
    data: ComponentCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Create a new component."""
    if data.group_id:
        group = db.query(ComponentGroup).filter(ComponentGroup.id == data.group_id).first()
        if not group:
            raise HTTPException(status_code=400, detail="Component group not found")
    
    component = Component(**data.model_dump())
    db.add(component)
    db.commit()
    db.refresh(component)
    
    log_action(db, user.user_id, "create", "component", str(component.id), None, data.model_dump())
    
    return component


@router.patch("/{component_id}", response_model=ComponentResponse)
async def update_component(
    component_id: UUID,
    data: ComponentUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.EDITOR))],
):
    """Update a component."""
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    before = {k: getattr(component, k) for k in data.model_dump(exclude_unset=True).keys()}
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(component, key, value)
    
    db.commit()
    db.refresh(component)
    
    log_action(db, user.user_id, "update", "component", str(component.id), before, data.model_dump(exclude_unset=True))
    
    return component


@router.delete("/{component_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_component(
    component_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[CurrentUser, Depends(require_role(Role.ADMIN))],
):
    """Delete a component."""
    component = db.query(Component).filter(Component.id == component_id).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    
    log_action(db, user.user_id, "delete", "component", str(component.id), {"name": component.name}, None)
    
    db.delete(component)
    db.commit()
