"""FastAPI application entry point."""
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.openapi.utils import get_openapi

from app.core.config import get_settings
from app.core.database import Base
from app.api import components, incidents, maintenance, status


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    # Note: Database schema is managed by Alembic migrations
    # Run: alembic upgrade head
    yield
    # Shutdown: cleanup if needed


# OpenAPI schema configuration
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Status Page API",
        version=settings.api_version,
        description="""
## Internal Status Page API

API for managing service health status, incidents, and maintenance windows.

### Features
- **Components**: Manage service components and groups
- **Incidents**: Create, update, and resolve incidents
- **Maintenance**: Schedule and manage maintenance windows  
- **Status Overview**: Get aggregated system health status

### Authentication
Uses JWT tokens with OIDC. Include `Authorization: Bearer <token>` header.
        """,
        routes=app.routes,
        tags=[
            {"name": "Status", "description": "System health status overview"},
            {"name": "Components", "description": "Component and group management"},
            {"name": "Incidents", "description": "Incident lifecycle management"},
            {"name": "Maintenance", "description": "Maintenance window scheduling"},
            {"name": "Health", "description": "Health check endpoints"},
        ]
    )
    openapi_schema["info"]["x-logo"] = {
        "url": "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.openapi = custom_openapi


# CORS middleware - allow all origins for API spec access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for OpenAPI spec access
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID to each request."""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    return response


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler with request ID."""
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An internal error occurred",
                "request_id": request_id,
            }
        },
    )


# Health endpoints
@app.get("/healthz", tags=["Health"])
async def health_check():
    """Liveness probe for Kubernetes."""
    return {"status": "ok"}


@app.get("/readyz", tags=["Health"])
async def readiness_check():
    """Readiness probe for Kubernetes."""
    return {"status": "ready"}


# Register API routers
app.include_router(components.router, prefix="/v1")
app.include_router(incidents.router, prefix="/v1")
app.include_router(maintenance.router, prefix="/v1")
app.include_router(status.router, prefix="/v1")


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """API root endpoint with links to documentation."""
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "docs": "/docs",
        "redoc": "/redoc",
        "openapi": "/openapi.json",
    }

