"""Local authentication service for breakglass admin access."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import LocalUser

# JWT settings for local auth
LOCAL_JWT_SECRET = settings.database_url[:32]  # Use a portion of DB URL as secret (should be a proper secret)
LOCAL_JWT_ALGORITHM = "HS256"
LOCAL_JWT_EXPIRE_HOURS = 24


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def hash_password(password: str) -> str:
    """Hash a password for storage."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def create_local_token(user: LocalUser) -> str:
    """Create a JWT token for a local user."""
    expire = datetime.now(timezone.utc) + timedelta(hours=LOCAL_JWT_EXPIRE_HOURS)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "email": user.email or "",
        "name": user.display_name or user.username,
        "is_superadmin": user.is_superadmin,
        "type": "local",  # Distinguish from OIDC tokens
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, LOCAL_JWT_SECRET, algorithm=LOCAL_JWT_ALGORITHM)


def verify_local_token(token: str) -> Optional[dict]:
    """Verify a local JWT token and return the payload."""
    try:
        payload = jwt.decode(token, LOCAL_JWT_SECRET, algorithms=[LOCAL_JWT_ALGORITHM])
        if payload.get("type") != "local":
            return None
        return payload
    except jwt.PyJWTError:
        return None


def authenticate_user(db: Session, username: str, password: str) -> Optional[LocalUser]:
    """Authenticate a user by username and password."""
    user = db.query(LocalUser).filter(LocalUser.username == username).first()
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    
    # Update last login
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    
    return user


def create_local_user(
    db: Session,
    username: str,
    password: str,
    email: Optional[str] = None,
    display_name: Optional[str] = None,
    is_superadmin: bool = False,
) -> LocalUser:
    """Create a new local user."""
    user = LocalUser(
        id=uuid.uuid4(),
        username=username,
        password_hash=hash_password(password),
        email=email,
        display_name=display_name or username,
        is_superadmin=is_superadmin,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_local_user_password(db: Session, user: LocalUser, new_password: str) -> None:
    """Update a user's password."""
    user.password_hash = hash_password(new_password)
    db.commit()


def get_or_create_initial_admin(db: Session) -> Optional[LocalUser]:
    """Get or create the initial admin user from environment variables."""
    import os
    
    admin_username = os.environ.get("INITIAL_ADMIN_USERNAME", "admin")
    admin_password = os.environ.get("INITIAL_ADMIN_PASSWORD")
    
    if not admin_password:
        return None
    
    existing = db.query(LocalUser).filter(LocalUser.username == admin_username).first()
    if existing:
        return existing
    
    return create_local_user(
        db=db,
        username=admin_username,
        password=admin_password,
        display_name="Administrator",
        is_superadmin=True,
    )
