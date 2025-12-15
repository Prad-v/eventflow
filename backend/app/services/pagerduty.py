"""PagerDuty API client and sync service."""
import json
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.models.models import Datasource, ExternalIncident, Incident, Severity, IncidentStatus


class PagerDutyClient:
    """Client for PagerDuty REST API v2."""
    
    DEFAULT_BASE_URL = "https://api.pagerduty.com"
    
    def __init__(self, api_key: str, base_url: str = None):
        self.api_key = api_key
        self.base_url = base_url or self.DEFAULT_BASE_URL
        self.headers = {
            "Authorization": f"Token token={api_key}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.pagerduty+json;version=2",
        }

    
    async def test_connection(self) -> dict:
        """Test the API connection by getting current user."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{self.base_url}/users/me",
                headers=self.headers,
            )
            if response.status_code == 200:
                user = response.json().get("user", {})
                return {
                    "success": True,
                    "user": user.get("name"),
                    "email": user.get("email"),
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text[:200]}",
                }
    
    async def get_incidents(
        self,
        statuses: list[str] = None,
        service_ids: list[str] = None,
        since: datetime = None,
        limit: int = 100,
    ) -> list[dict]:
        """Fetch incidents from PagerDuty."""
        if statuses is None:
            statuses = ["triggered", "acknowledged"]
        
        params = {
            "statuses[]": statuses,
            "limit": limit,
            "sort_by": "created_at:desc",
        }
        
        if service_ids:
            params["service_ids[]"] = service_ids
        
        if since:
            params["since"] = since.isoformat()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/incidents",
                headers=self.headers,
                params=params,
            )
            
            if response.status_code != 200:
                raise Exception(f"PagerDuty API error: {response.status_code}")
            
            return response.json().get("incidents", [])


def map_pd_severity(urgency: str) -> Severity:
    """Map PagerDuty urgency to our severity."""
    return Severity.CRITICAL if urgency == "high" else Severity.MAJOR


def map_pd_status(status: str) -> IncidentStatus:
    """Map PagerDuty status to our status."""
    mapping = {
        "triggered": IncidentStatus.INVESTIGATING,
        "acknowledged": IncidentStatus.IDENTIFIED,
        "resolved": IncidentStatus.RESOLVED,
    }
    return mapping.get(status, IncidentStatus.INVESTIGATING)


async def sync_pagerduty_incidents(db: Session, datasource: Datasource) -> dict:
    """
    Sync incidents from PagerDuty to local database.
    
    Returns sync statistics.
    """
    from app.api.settings import decrypt_secret
    
    # Parse config
    try:
        config = json.loads(decrypt_secret(datasource.config_encrypted))
    except Exception as e:
        return {"error": f"Invalid config: {str(e)}"}
    
    api_key = config.get("api_key")
    if not api_key:
        return {"error": "API key not configured"}
    
    service_ids = config.get("service_ids", [])
    base_url = config.get("base_url")  # Optional: for mock PagerDuty
    
    # Update sync status
    datasource.sync_status = "syncing"
    db.commit()
    
    try:
        client = PagerDutyClient(api_key, base_url=base_url)
        
        # Fetch active incidents
        incidents = await client.get_incidents(
            statuses=["triggered", "acknowledged"],
            service_ids=service_ids if service_ids else None,
        )
        
        created = 0
        updated = 0
        
        for pd_incident in incidents:
            pd_id = pd_incident["id"]
            
            # Check if we already have this incident
            existing = db.query(ExternalIncident).filter(
                ExternalIncident.datasource_id == datasource.id,
                ExternalIncident.external_id == pd_id,
            ).first()
            
            if existing:
                # Update existing incident
                if existing.incident:
                    existing.incident.title = pd_incident["title"]
                    existing.incident.severity = map_pd_severity(pd_incident.get("urgency", "high"))
                    existing.incident.status = map_pd_status(pd_incident["status"])
                    if pd_incident["status"] == "resolved" and pd_incident.get("resolved_at"):
                        existing.incident.resolved_at = datetime.fromisoformat(
                            pd_incident["resolved_at"].replace("Z", "+00:00")
                        )
                existing.raw_data = pd_incident
                existing.synced_at = datetime.now(timezone.utc)
                updated += 1
            else:
                # Create new incident
                incident = Incident(
                    title=pd_incident["title"],
                    severity=map_pd_severity(pd_incident.get("urgency", "high")),
                    status=map_pd_status(pd_incident["status"]),
                    started_at=datetime.fromisoformat(
                        pd_incident["created_at"].replace("Z", "+00:00")
                    ),
                    source="pagerduty",
                    created_by=f"pagerduty:{datasource.name}",
                )
                db.add(incident)
                db.flush()  # Get the ID
                
                # Create external incident link
                external = ExternalIncident(
                    datasource_id=datasource.id,
                    external_id=pd_id,
                    incident_id=incident.id,
                    external_url=pd_incident.get("html_url"),
                    raw_data=pd_incident,
                    synced_at=datetime.now(timezone.utc),
                )
                db.add(external)
                created += 1
        
        # Also sync resolved incidents (to update status)
        resolved_incidents = await client.get_incidents(
            statuses=["resolved"],
            service_ids=service_ids if service_ids else None,
            limit=50,
        )
        
        for pd_incident in resolved_incidents:
            pd_id = pd_incident["id"]
            existing = db.query(ExternalIncident).filter(
                ExternalIncident.datasource_id == datasource.id,
                ExternalIncident.external_id == pd_id,
            ).first()
            
            if existing and existing.incident:
                existing.incident.status = IncidentStatus.RESOLVED
                if pd_incident.get("resolved_at"):
                    existing.incident.resolved_at = datetime.fromisoformat(
                        pd_incident["resolved_at"].replace("Z", "+00:00")
                    )
                existing.raw_data = pd_incident
                existing.synced_at = datetime.now(timezone.utc)
                updated += 1
        
        # Update datasource status
        datasource.sync_status = "success"
        datasource.last_sync_at = datetime.now(timezone.utc)
        datasource.sync_error = None
        db.commit()
        
        return {
            "success": True,
            "created": created,
            "updated": updated,
            "total_fetched": len(incidents) + len(resolved_incidents),
        }
        
    except Exception as e:
        datasource.sync_status = "error"
        datasource.sync_error = str(e)
        db.commit()
        return {"success": False, "error": str(e)}
