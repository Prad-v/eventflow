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


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)]
) -> CurrentUser:
    """
    Extract and validate the current user from JWT token.
    
    For development, returns a mock admin user if no token provided.
    In production, this should validate the JWT against OIDC provider.
    """
    if credentials is None:
        # Development mode: return mock user
        return CurrentUser(
            user_id="dev-user",
            email="dev@example.com",
            roles=[Role.ADMIN],
            name="Development User",
        )
    
    # TODO: Validate JWT token against OIDC provider
    # This would involve:
    # 1. Fetch JWKS from OIDC provider
    # 2. Validate token signature
    # 3. Validate claims (exp, iss, aud)
    # 4. Extract user info and roles
    
    return CurrentUser(
        user_id="dev-user",
        email="dev@example.com",
        roles=[Role.ADMIN],
        name="Development User",
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
