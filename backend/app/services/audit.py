"""Audit logging service."""
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import AuditLog


def log_action(
    db: Session,
    actor: str,
    action: str,
    entity_type: str,
    entity_id: str,
    before_state: Optional[dict],
    after_state: Optional[dict],
) -> AuditLog:
    """
    Log an action to the audit trail.
    
    Args:
        db: Database session
        actor: User ID performing the action
        action: Action type (create, update, delete, etc.)
        entity_type: Type of entity being modified
        entity_id: ID of the entity
        before_state: State before the change (for updates/deletes)
        after_state: State after the change (for creates/updates)
    
    Returns:
        The created audit log entry
    """
    # Convert any non-serializable values
    def serialize(value):
        if value is None:
            return None
        if isinstance(value, dict):
            return {k: serialize(v) for k, v in value.items()}
        if hasattr(value, 'isoformat'):
            return value.isoformat()
        if hasattr(value, 'value'):  # Enum
            return value.value
        return str(value) if not isinstance(value, (str, int, float, bool, list)) else value
    
    log_entry = AuditLog(
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_state=serialize(before_state),
        after_state=serialize(after_state),
    )
    
    db.add(log_entry)
    db.commit()
    
    return log_entry
