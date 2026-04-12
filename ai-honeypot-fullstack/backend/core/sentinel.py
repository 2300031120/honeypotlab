"""
Microsoft Sentinel SIEM Integration
Forwards deception events to Microsoft Sentinel via Log Analytics REST API
"""

import logging
import hashlib
import hmac
import base64
import json
import httpx
from typing import Any, Dict, List, Optional
from datetime import datetime
from core.config import (
    SENTINEL_WORKSPACE_ID,
    SENTINEL_SHARED_KEY,
    SENTINEL_LOG_TYPE,
    SENTINEL_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


class SentinelIntegration:
    """Integration with Microsoft Sentinel for event forwarding"""

    def __init__(self):
        self.workspace_id = SENTINEL_WORKSPACE_ID
        self.shared_key = SENTINEL_SHARED_KEY
        self.log_type = SENTINEL_LOG_TYPE
        self.timeout = SENTINEL_TIMEOUT_SECONDS
        self.enabled = bool(SENTINEL_WORKSPACE_ID and SENTINEL_SHARED_KEY)
        self.api_url = f"https://{self.workspace_id}.ods.opinsights.azure.com/api/logs?api-version=2016-04-01"

    def _build_signature(self, date: str, content_length: int, method: str, content_type: str, resource: str) -> str:
        """
        Build the authorization signature for Azure Log Analytics
        
        Args:
            date: RFC1123 formatted date string
            content_length: Length of request body
            method: HTTP method
            content_type: Content type header
            resource: API resource path
            
        Returns:
            Base64-encoded signature
        """
        x_headers = f"x-ms-date:{date}"
        string_to_hash = f"{method}\n{content_length}\n{content_type}\n{x_headers}\n{resource}"
        bytes_to_hash = string_to_hash.encode("utf-8")
        decoded_key = base64.b64decode(self.shared_key)
        encoded_hash = base64.b64encode(
            hmac.new(decoded_key, bytes_to_hash, digestmod=hashlib.sha256).digest()
        ).decode()
        authorization = f"SharedKey {self.workspace_id}:{encoded_hash}"
        return authorization

    def _get_headers(self, content_length: int, date: str) -> Dict[str, str]:
        """Get authentication headers for Sentinel API"""
        return {
            "Content-Type": "application/json",
            "Authorization": self._build_signature(
                date, content_length, "POST", "application/json", "/api/logs"
            ),
            "Log-Type": self.log_type,
            "x-ms-date": date,
            "time-generated-field": "timestamp",
        }

    async def forward_event(self, event: Dict[str, Any]) -> bool:
        """
        Forward a single deception event to Microsoft Sentinel
        
        Args:
            event: Event dictionary with deception data
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            logger.debug("Sentinel integration not enabled")
            return False

        try:
            # Transform event to Sentinel format
            sentinel_event = self._transform_event(event)
            body = json.dumps(sentinel_event)
            content_length = len(body)
            
            # Get current date in RFC1123 format
            from email.utils import formatdate
            date = formatdate(timeval=None, localtime=False, usegmt=True)
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.api_url,
                    headers=self._get_headers(content_length, date),
                    content=body,
                )
                
                if response.status_code in (200, 202):
                    logger.info(f"Successfully forwarded event to Sentinel: {event.get('id')}")
                    return True
                else:
                    logger.error(f"Sentinel API error: {response.status_code} - {response.text}")
                    return False
                    
        except httpx.TimeoutException:
            logger.error("Sentinel API timeout")
            return False
        except Exception as exc:
            logger.error(f"Sentinel integration error: {exc}")
            return False

    async def forward_events_batch(self, events: List[Dict[str, Any]]) -> int:
        """
        Forward multiple events to Sentinel in batch
        
        Args:
            events: List of event dictionaries
            
        Returns:
            Number of successfully forwarded events
        """
        if not self.enabled or not events:
            return 0

        # Sentinel doesn't have a bulk API, so we send events individually
        success_count = 0
        for event in events:
            if await self.forward_event(event):
                success_count += 1
                
        return success_count

    def _transform_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform deception event to Sentinel-compatible format
        
        Args:
            event: Original deception event
            
        Returns:
            Event in Sentinel-compatible format
        """
        # Extract relevant fields
        event_id = event.get("id") or event.get("event_id")
        event_type = event.get("event_type") or event.get("type", "decoy_access")
        severity = event.get("severity") or event.get("risk_score", "medium")
        ip_address = event.get("ip") or event.get("client_ip")
        url_path = event.get("url_path") or event.get("path")
        cmd = event.get("cmd") or event.get("command")
        country = event.get("country") or event.get("geo_country")
        timestamp = event.get("ts") or event.get("timestamp") or datetime.utcnow().isoformat()
        
        # Build Sentinel-compatible event
        sentinel_event = {
            "EventID": str(event_id),
            "EventType": event_type,
            "Severity": self._map_severity(severity),
            "SourceIP": ip_address,
            "DestinationIP": event.get("server_ip", "decoy"),
            "DestinationPort": event.get("port", 443),
            "Protocol": event.get("protocol", "HTTP"),
            "Timestamp": timestamp,
            "Description": f"Deception event: {event_type} on {url_path}",
            "Category": "Deception",
            "DeviceType": "Honeypot",
            "LogSourceType": "CyberSentil Deception",
            "URLPath": url_path,
            "Command": cmd,
            "SourceCountry": country,
            "AttackerType": event.get("attacker_type"),
            "SessionID": str(event.get("session_id")) if event.get("session_id") else None,
            "IPReputation": event.get("reputation"),
        }
        
        # Remove None values
        sentinel_event = {k: v for k, v in sentinel_event.items() if v is not None}
        
        return sentinel_event

    def _map_severity(self, severity: Any) -> str:
        """
        Map severity to Sentinel severity levels
        
        Args:
            severity: Severity value (string or number)
            
        Returns:
            Sentinel severity (Low, Medium, High, Critical)
        """
        severity_map = {
            "critical": "Critical",
            "high": "High",
            "medium": "Medium",
            "low": "Low",
            "info": "Low",
        }
        
        if isinstance(severity, int):
            if severity >= 8:
                return "Critical"
            elif severity >= 6:
                return "High"
            elif severity >= 4:
                return "Medium"
            else:
                return "Low"
                
        return severity_map.get(str(severity).lower(), "Medium")

    async def test_connection(self) -> bool:
        """
        Test connection to Microsoft Sentinel API
        
        Returns:
            True if connection successful, False otherwise
        """
        if not self.enabled:
            return False

        try:
            # Send a test event
            test_event = {
                "EventID": "test-connection",
                "EventType": "test",
                "Severity": "Low",
                "Timestamp": datetime.utcnow().isoformat(),
            }
            
            if await self.forward_event(test_event):
                logger.info("Sentinel connection test successful")
                return True
            else:
                logger.error("Sentinel connection test failed")
                return False
                
        except Exception as exc:
            logger.error(f"Sentinel connection test error: {exc}")
            return False


# Global instance
sentinel_integration = SentinelIntegration()
