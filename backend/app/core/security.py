"""Security and authentication utilities."""
from enum import Enum
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


security = HTTPBearer(auto_error=False)

# Cache for OIDC active status (refreshed periodically)
_oidc_active_cache: dict = {"active": False, "checked_at": None}


class Role(str, Enum):
    """User roles for RBAC."""
    VIEWER = "viewer"
    EDITOR = "editor"
    ADMIN = "admin"


class CurrentUser:
    """Represents the authenticated user."""
    
    def __init__(
        self,
        user_id: str,
        email: str,
        roles: list[Role],
        name: str = "",
        auth_type: str = "oidc",  # "oidc" or "local"
    ):
        self.user_id = user_id
        self.email = email
        self.roles = roles
        self.name = name
        self.auth_type = auth_type
    
    def has_role(self, role: Role) -> bool:
        """Check if user has a specific role."""
        if Role.ADMIN in self.roles:
            return True
        return role in self.roles


# Anonymous user for when OIDC is not active
ANONYMOUS_USER = CurrentUser(
    user_id="anonymous",
    email="",
    roles=[Role.ADMIN],  # Full access when OIDC not active
    name="Anonymous",
    auth_type="none",
)


import jwt
from jwt import PyJWKClient
from app.core.config import settings

# JWKS Client for OIDC validation - lazy initialization
_jwks_client: Optional[PyJWKClient] = None


def get_jwks_client() -> PyJWKClient:
    """Get or create JWKS client (lazy initialization to handle startup errors)."""
    global _jwks_client
    if _jwks_client is None:
        try:
            _jwks_client = PyJWKClient(f"{settings.LOGTO_ENDPOINT}/oidc/jwks")
        except Exception:
            pass
    return _jwks_client


def is_oidc_active() -> bool:
    """
    Check if OIDC is active (enabled AND provisioned).
    
    This is cached for 30 seconds to avoid hitting the DB on every request.
    """
    import time
    from app.core.database import SessionLocal
    from app.models.models import OIDCConfig
    
    global _oidc_active_cache
    
    # Check cache (30 second TTL)
    now = time.time()
    if _oidc_active_cache["checked_at"] and (now - _oidc_active_cache["checked_at"]) < 30:
        return _oidc_active_cache["active"]
    
    # Query database
    try:
        db = SessionLocal()
        config = db.query(OIDCConfig).first()
        is_active = config and config.enabled and config.is_provisioned
        _oidc_active_cache = {"active": is_active, "checked_at": now}
        db.close()
        return is_active
    except Exception:
        return _oidc_active_cache.get("active", False)


def validate_local_token(token: str) -> Optional[CurrentUser]:
    """Try to validate token as a local JWT."""
    from app.services.local_auth import verify_local_token
    
    payload = verify_local_token(token)
    if not payload:
        return None
    
    # Local superadmin gets ADMIN role
    roles = [Role.ADMIN] if payload.get("is_superadmin") else [Role.VIEWER]
    
    return CurrentUser(
        user_id=payload.get("sub"),
        email=payload.get("email", ""),
        roles=roles,
        name=payload.get("name", ""),
        auth_type="local",
    )


def validate_oidc_token(token: str) -> Optional[CurrentUser]:
    """Try to validate token as an OIDC JWT."""
    jwks_client = get_jwks_client()
    if not jwks_client:
        return None
    
    try:
        # 1. Get Signing Key
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # 2. Decode and Validate
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.LOGTO_AUDIENCE,
            issuer=f"{settings.LOGTO_ENDPOINT}/oidc",
        )
        
        # 3. Extract User Info
        user_id = payload.get("sub")
        roles_claim = payload.get("roles", [])
        
        # Map Logto roles to internal roles
        internal_roles = []
        for r in roles_claim:
            if r.lower() == "admin":
                internal_roles.append(Role.ADMIN)
            elif r.lower() == "editor":
                internal_roles.append(Role.EDITOR)
        
        # If no roles but valid token, default to VIEWER
        if not internal_roles:
            internal_roles.append(Role.VIEWER)

        return CurrentUser(
            user_id=user_id,
            email=payload.get("email", ""),
            roles=internal_roles,
            name=payload.get("name", ""),
            auth_type="oidc",
        )
        
    except jwt.PyJWTError:
        return None


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)]
) -> CurrentUser:
    """
    Extract and validate the current user from JWT token.
    
    Supports dual authentication:
    1. First tries local JWT (breakglass admin)
    2. Falls back to OIDC JWT (Logto)
    3. If OIDC is not active and no credentials, returns anonymous user with full access
    """
    # If OIDC is not active and no credentials, allow anonymous access
    if not credentials:
        if not is_oidc_active():
            return ANONYMOUS_USER
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    # Try local auth first (breakglass)
    user = validate_local_token(token)
    if user:
        return user
    
    # Try OIDC auth
    user = validate_oidc_token(token)
    if user:
        return user
    
    # Neither worked
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)]
) -> Optional[CurrentUser]:
    """
    Get current user if authenticated, otherwise return None.
    
    Useful for routes that should work with or without authentication.
    """
    if not credentials:
        return None
    
    token = credentials.credentials
    
    # Try local auth first
    user = validate_local_token(token)
    if user:
        return user
    
    # Try OIDC auth
    user = validate_oidc_token(token)
    if user:
        return user
    
    return None


def require_role(role: Role):
    """Dependency factory that requires a specific role."""
    async def role_checker(
        user: Annotated[CurrentUser, Depends(get_current_user)]
    ) -> CurrentUser:
        if not user.has_role(role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role.value}' required",
            )
        return user
    return role_checker


def clear_oidc_cache():
    """Clear the OIDC active status cache. Call after updating OIDC config."""
    global _oidc_active_cache
    _oidc_active_cache = {"active": False, "checked_at": None}
