"""
Mock PagerDuty API Service
Simulates PagerDuty API v2 for testing the datasource integration.
"""
import uuid
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Mock PagerDuty API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data storage
MOCK_INCIDENTS: list[dict] = []
MOCK_SERVICES: list[dict] = [
    {"id": "PSVC001", "name": "API Gateway", "status": "active"},
    {"id": "PSVC002", "name": "Database Cluster", "status": "active"},
    {"id": "PSVC003", "name": "Auth Service", "status": "active"},
]
MOCK_USERS: list[dict] = [
    {"id": "PUSER01", "name": "Mock Admin", "email": "admin@mock-pagerduty.local"},
]

# Valid API keys for testing
VALID_API_KEYS = ["mock-pd-api-key-12345", "test-api-key"]


def verify_auth(authorization: Optional[str]) -> bool:
    """Verify the Authorization header."""
    if not authorization:
        return False
    if authorization.startswith("Token token="):
        token = authorization.replace("Token token=", "")
        return token in VALID_API_KEYS
    return False


def generate_mock_incidents():
    """Generate some mock incidents on startup."""
    global MOCK_INCIDENTS
    severities = ["critical", "high", "low"]
    statuses = ["triggered", "acknowledged", "resolved"]
    titles = [
        "High CPU usage on production servers",
        "Database connection timeout",
        "API response time degraded",
        "Memory leak detected in worker nodes",
        "SSL certificate expiring soon",
        "Disk space running low on storage cluster",
        "Network latency spike detected",
        "Service health check failing",
    ]
    
    MOCK_INCIDENTS = []
    for i, title in enumerate(titles):
        status = random.choice(statuses[:2]) if i < 5 else "resolved"  # First 5 are active
        urgency = random.choice(severities[:2])
        created_at = datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48))
        
        incident = {
            "id": f"PINC{str(i+1).zfill(3)}",
            "incident_number": i + 1,
            "title": title,
            "description": f"Mock incident: {title}",
            "created_at": created_at.isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "urgency": urgency,
            "html_url": f"https://mock-pagerduty.local/incidents/PINC{str(i+1).zfill(3)}",
            "service": random.choice(MOCK_SERVICES),
            "escalation_policy": {"id": "PESC001", "type": "escalation_policy_reference"},
            "teams": [],
            "priority": None,
            "resolved_at": (datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 1))).isoformat() if status == "resolved" else None,
            "acknowledgements": [],
            "assignments": [],
            "alert_counts": {"all": 1, "triggered": 0 if status == "resolved" else 1, "resolved": 1 if status == "resolved" else 0},
            "type": "incident",
        }
        MOCK_INCIDENTS.append(incident)


# Generate mock data on startup
generate_mock_incidents()


# Pydantic models
class User(BaseModel):
    id: str
    name: str
    email: str


class UserResponse(BaseModel):
    user: User


class IncidentListResponse(BaseModel):
    incidents: list[dict]
    limit: int
    offset: int
    total: int
    more: bool


class ServiceListResponse(BaseModel):
    services: list[dict]


# Endpoints
@app.get("/")
async def root():
    return {"message": "Mock PagerDuty API", "version": "v2"}


@app.get("/users/me", response_model=UserResponse)
async def get_current_user(authorization: Optional[str] = Header(None)):
    """Get current user - used for connection testing."""
    if not verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return {"user": MOCK_USERS[0]}


@app.get("/incidents", response_model=IncidentListResponse)
async def list_incidents(
    authorization: Optional[str] = Header(None),
    statuses: Optional[str] = None,
    service_ids: Optional[str] = None,
    since: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    """List incidents with optional filtering."""
    if not verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Parse statuses from query params (PD uses statuses[]=xxx format)
    status_filter = []
    if statuses:
        status_filter = statuses.split(",")
    
    # Filter incidents
    filtered = MOCK_INCIDENTS
    
    if status_filter:
        filtered = [i for i in filtered if i["status"] in status_filter]
    
    if service_ids:
        svc_ids = service_ids.split(",")
        filtered = [i for i in filtered if i["service"]["id"] in svc_ids]
    
    # Sort by created_at descending
    filtered = sorted(filtered, key=lambda x: x["created_at"], reverse=True)
    
    # Paginate
    total = len(filtered)
    paginated = filtered[offset:offset + limit]
    
    return {
        "incidents": paginated,
        "limit": limit,
        "offset": offset,
        "total": total,
        "more": offset + limit < total,
    }


@app.get("/services", response_model=ServiceListResponse)
async def list_services(authorization: Optional[str] = Header(None)):
    """List all services."""
    if not verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return {"services": MOCK_SERVICES}


@app.post("/incidents/{incident_id}/resolve")
async def resolve_incident(
    incident_id: str,
    authorization: Optional[str] = Header(None),
):
    """Resolve an incident."""
    if not verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    for inc in MOCK_INCIDENTS:
        if inc["id"] == incident_id:
            inc["status"] = "resolved"
            inc["resolved_at"] = datetime.now(timezone.utc).isoformat()
            inc["updated_at"] = datetime.now(timezone.utc).isoformat()
            return {"incident": inc}
    
    raise HTTPException(status_code=404, detail="Incident not found")


@app.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(
    incident_id: str,
    authorization: Optional[str] = Header(None),
):
    """Acknowledge an incident."""
    if not verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    for inc in MOCK_INCIDENTS:
        if inc["id"] == incident_id:
            if inc["status"] == "triggered":
                inc["status"] = "acknowledged"
                inc["updated_at"] = datetime.now(timezone.utc).isoformat()
            return {"incident": inc}
    
    raise HTTPException(status_code=404, detail="Incident not found")


@app.post("/incidents")
async def create_incident(
    authorization: Optional[str] = Header(None),
):
    """Create a new incident (for testing)."""
    if not verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    new_id = f"PINC{str(len(MOCK_INCIDENTS) + 1).zfill(3)}"
    incident = {
        "id": new_id,
        "incident_number": len(MOCK_INCIDENTS) + 1,
        "title": f"Test incident created at {datetime.now(timezone.utc).isoformat()}",
        "description": "Manually created test incident",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "status": "triggered",
        "urgency": "high",
        "html_url": f"https://mock-pagerduty.local/incidents/{new_id}",
        "service": MOCK_SERVICES[0],
        "resolved_at": None,
        "type": "incident",
    }
    MOCK_INCIDENTS.append(incident)
    
    return {"incident": incident}


@app.post("/reset")
async def reset_mock_data():
    """Reset mock data to initial state."""
    generate_mock_incidents()
    return {"message": "Mock data reset", "incident_count": len(MOCK_INCIDENTS)}


@app.get("/healthz")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
