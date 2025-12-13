"""Webhook notification service for Slack and other integrations."""
import asyncio
import json
from typing import Optional
from datetime import datetime
import logging

import aiohttp

from app.core.config import get_settings
from app.models.models import Incident, MaintenanceWindow, Severity, IncidentStatus


settings = get_settings()
logger = logging.getLogger(__name__)


class WebhookService:
    """Service for sending webhook notifications."""
    
    def __init__(self):
        self.slack_webhook_url: Optional[str] = getattr(settings, 'slack_webhook_url', None)
        self.custom_webhook_urls: list[str] = getattr(settings, 'custom_webhook_urls', [])
    
    @property
    def enabled(self) -> bool:
        """Check if webhooks are configured."""
        return bool(self.slack_webhook_url or self.custom_webhook_urls)
    
    def _get_severity_color(self, severity: Severity) -> str:
        """Get Slack color for severity level."""
        colors = {
            Severity.CRITICAL: "#dc2626",  # Red
            Severity.MAJOR: "#ea580c",     # Orange
            Severity.MINOR: "#d97706",     # Amber
            Severity.INFO: "#0891b2",      # Cyan
        }
        return colors.get(severity, "#6366f1")
    
    def _get_status_emoji(self, status: IncidentStatus) -> str:
        """Get emoji for incident status."""
        emojis = {
            IncidentStatus.INVESTIGATING: "🔍",
            IncidentStatus.IDENTIFIED: "🔎",
            IncidentStatus.MONITORING: "👀",
            IncidentStatus.RESOLVED: "✅",
        }
        return emojis.get(status, "⚠️")
    
    async def send_slack_message(self, payload: dict) -> bool:
        """Send a message to Slack webhook."""
        if not self.slack_webhook_url:
            return False
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.slack_webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    return response.status == 200
        except Exception as e:
            logger.error(f"Failed to send Slack message: {e}")
            return False
    
    async def notify_incident_created(
        self, 
        incident: Incident, 
        initial_message: str,
        affected_components: list[str],
    ) -> bool:
        """Send notification when a new incident is created."""
        if not self.enabled:
            return False
        
        emoji = self._get_severity_color(incident.severity)
        
        payload = {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🚨 New Incident: {incident.title}",
                        "emoji": True,
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Severity:* {incident.severity.value.upper()}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Status:* {incident.status.value.replace('_', ' ').title()}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Initial Update:*\n{initial_message}"
                    }
                },
            ],
            "attachments": [
                {
                    "color": self._get_severity_color(incident.severity),
                    "fields": [
                        {
                            "title": "Affected Components",
                            "value": ", ".join(affected_components) if affected_components else "None specified",
                            "short": False,
                        }
                    ],
                    "footer": "Status Page",
                    "ts": int(datetime.utcnow().timestamp()),
                }
            ]
        }
        
        return await self.send_slack_message(payload)
    
    async def notify_incident_updated(
        self,
        incident: Incident,
        update_message: str,
        new_status: IncidentStatus,
    ) -> bool:
        """Send notification when an incident is updated."""
        if not self.enabled:
            return False
        
        emoji = self._get_status_emoji(new_status)
        
        payload = {
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"{emoji} *Incident Update:* {incident.title}"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Status:* {new_status.value.replace('_', ' ').title()}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Update:*\n{update_message}"
                    }
                },
            ]
        }
        
        return await self.send_slack_message(payload)
    
    async def notify_incident_resolved(
        self,
        incident: Incident,
        resolution_message: str,
    ) -> bool:
        """Send notification when an incident is resolved."""
        if not self.enabled:
            return False
        
        duration = ""
        if incident.resolved_at and incident.started_at:
            delta = incident.resolved_at - incident.started_at
            hours, remainder = divmod(int(delta.total_seconds()), 3600)
            minutes, _ = divmod(remainder, 60)
            if hours > 0:
                duration = f"{hours}h {minutes}m"
            else:
                duration = f"{minutes}m"
        
        payload = {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"✅ Incident Resolved: {incident.title}",
                        "emoji": True,
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Duration:* {duration}" if duration else "*Duration:* N/A"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Severity:* {incident.severity.value.upper()}"
                        }
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Resolution:*\n{resolution_message}"
                    }
                },
            ],
            "attachments": [
                {
                    "color": "#10b981",  # Green
                    "footer": "Status Page",
                    "ts": int(datetime.utcnow().timestamp()),
                }
            ]
        }
        
        return await self.send_slack_message(payload)
    
    async def notify_maintenance_scheduled(
        self,
        maintenance: MaintenanceWindow,
        affected_components: list[str],
    ) -> bool:
        """Send notification when maintenance is scheduled."""
        if not self.enabled:
            return False
        
        payload = {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🔧 Maintenance Scheduled: {maintenance.title}",
                        "emoji": True,
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Start:* {maintenance.start_at.strftime('%Y-%m-%d %H:%M UTC')}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*End:* {maintenance.end_at.strftime('%Y-%m-%d %H:%M UTC')}"
                        }
                    ]
                },
            ],
            "attachments": [
                {
                    "color": "#6366f1",  # Purple
                    "fields": [
                        {
                            "title": "Affected Components",
                            "value": ", ".join(affected_components) if affected_components else "None specified",
                            "short": False,
                        }
                    ],
                    "footer": "Status Page",
                    "ts": int(datetime.utcnow().timestamp()),
                }
            ]
        }
        
        return await self.send_slack_message(payload)


# Singleton instance
webhook = WebhookService()


# Helper function for sync context
def send_notification(coro):
    """Run async notification in sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already in async context, schedule it
            asyncio.create_task(coro)
        else:
            loop.run_until_complete(coro)
    except RuntimeError:
        # No event loop, create one
        asyncio.run(coro)
