"""Security and authentication utilities."""
from enum import Enum
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


security = HTTPBearer(auto_error=False)


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
    ):
        self.user_id = user_id
        self.email = email
        self.roles = roles
        self.name = name
    
    def has_role(self, role: Role) -> bool:
        """Check if user has a specific role."""
        if Role.ADMIN in self.roles:
            return True
        return role in self.roles


import jwt
from jwt import PyJWKClient
from app.core.config import settings

# JWKS Client
jwks_client = PyJWKClient(f"{settings.LOGTO_ENDPOINT}/oidc/jwks")

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)]
) -> CurrentUser:
    """
    Extract and validate the current user from JWT token.
    """
    if not credentials:
        # If no token, maybe return anonymous or raise 401?
        # For this status page, we might allow public access to GET but restrict writes.
        # But 'require_role' will enforce permissions.
        # If we stick to previous behavior of dev-user mock if specific env var set?
        # Let's enforce auth properly.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
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
        # Logto puts roles in `roles` claim if RBAC is configured and scope requested
        # Or custom claims. For now let's check `scope` or `roles`.
        # Assuming Logto standard RBAC structure in 'roles' claim
        roles_claim = payload.get("roles", [])
        
        # Map Logto roles to internal roles
        internal_roles = []
        for r in roles_claim:
            if r.lower() == "admin":
                internal_roles.append(Role.ADMIN)
            elif r.lower() == "editor":
                internal_roles.append(Role.EDITOR)
        
        # If no roles but valid token, maybe VIEWER?
        if not internal_roles:
            internal_roles.append(Role.VIEWER)

        return CurrentUser(
            user_id=user_id,
            email=payload.get("email", ""),
            roles=internal_roles,
            name=payload.get("name", ""),
        )
        
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


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
