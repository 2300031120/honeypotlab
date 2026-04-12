"""
Elastic Security SIEM Integration
Forwards deception events to Elastic Security (Elastic Stack)
"""

import logging
import httpx
from typing import Any, Dict, List, Optional
from datetime import datetime
from core.config import (
    ELASTIC_HOST,
    ELASTIC_PORT,
    ELASTIC_USERNAME,
    ELASTIC_PASSWORD,
    ELASTIC_API_KEY,
    ELASTIC_INDEX,
    ELASTIC_VERIFY_TLS,
    ELASTIC_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


class ElasticIntegration:
    """Integration with Elastic Security for event forwarding"""

    def __init__(self):
        self.base_url = f"https://{ELASTIC_HOST}:{ELASTIC_PORT}"
        self.username = ELASTIC_USERNAME
        self.password = ELASTIC_PASSWORD
        self.api_key = ELASTIC_API_KEY
        self.index = ELASTIC_INDEX
        self.verify_tls = ELASTIC_VERIFY_TLS
        self.timeout = ELASTIC_TIMEOUT_SECONDS
        self.enabled = bool(ELASTIC_HOST and (ELASTIC_API_KEY or (ELASTIC_USERNAME and ELASTIC_PASSWORD)))

    def _get_headers(self) -> Dict[str, str]:
        """Get authentication headers for Elastic API"""
        headers = {"Content-Type": "application/json"}
        
        if self.api_key:
            headers["Authorization"] = f"ApiKey {self.api_key}"
        elif self.username and self.password:
            import base64
            credentials = f"{self.username}:{self.password}"
            encoded = base64.b64encode(credentials.encode()).decode()
            headers["Authorization"] = f"Basic {encoded}"
            
        return headers

    async def forward_event(self, event: Dict[str, Any]) -> bool:
        """
        Forward a single deception event to Elastic Security
        
        Args:
            event: Event dictionary with deception data
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            logger.debug("Elastic integration not enabled")
            return False

        try:
            # Transform event to Elastic Common Schema (ECS) format
            elastic_event = self._transform_event(event)
            
            async with httpx.AsyncClient(verify=self.verify_tls, timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/{self.index}/_doc",
                    headers=self._get_headers(),
                    json=elastic_event,
                )
                
                if response.status_code in (200, 201):
                    logger.info(f"Successfully forwarded event to Elastic: {event.get('id')}")
                    return True
                else:
                    logger.error(f"Elastic API error: {response.status_code} - {response.text}")
                    return False
                    
        except httpx.TimeoutException:
            logger.error("Elastic API timeout")
            return False
        except Exception as exc:
            logger.error(f"Elastic integration error: {exc}")
            return False

    async def forward_events_batch(self, events: List[Dict[str, Any]]) -> int:
        """
        Forward multiple events to Elastic in batch using bulk API
        
        Args:
            events: List of event dictionaries
            
        Returns:
            Number of successfully forwarded events
        """
        if not self.enabled or not events:
            return 0

        try:
            # Build bulk request body
            bulk_body = []
            for event in events:
                elastic_event = self._transform_event(event)
                bulk_body.append({"index": {"_index": self.index}})
                bulk_body.append(elastic_event)
            
            async with httpx.AsyncClient(verify=self.verify_tls, timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/_bulk",
                    headers=self._get_headers(),
                    data="\n".join([str(item) for item in bulk_body]) + "\n",
                )
                
                if response.status_code == 200:
                    result = response.json()
                    success_count = result.get("items", [])
                    logger.info(f"Successfully forwarded {len(success_count)} events to Elastic in batch")
                    return len(success_count)
                else:
                    logger.error(f"Elastic bulk API error: {response.status_code} - {response.text}")
                    return 0
                    
        except Exception as exc:
            logger.error(f"Elastic bulk integration error: {exc}")
            return 0

    def _transform_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform deception event to Elastic Common Schema (ECS) format
        
        Args:
            event: Original deception event
            
        Returns:
            Event in ECS-compatible format
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
        
        # Build ECS-compliant event
        elastic_event = {
            "@timestamp": timestamp,
            "event": {
                "id": str(event_id),
                "category": ["deception", "security"],
                "type": event_type,
                "severity": self._map_severity(severity),
                "module": "cybersentil",
                "dataset": "deception.events",
            },
            "source": {
                "ip": ip_address,
                "geo": {
                    "country_name": country,
                } if country else {},
            },
            "destination": {
                "ip": event.get("server_ip", "decoy"),
                "port": event.get("port", 443),
            },
            "url": {
                "path": url_path,
            } if url_path else {},
            "deception": {
                "event_type": event_type,
                "trap_path": url_path,
                "command": cmd,
                "attacker_type": event.get("attacker_type"),
                "session_id": str(event.get("session_id")) if event.get("session_id") else None,
                "ip_reputation": event.get("reputation"),
            },
            "tags": ["deception", "honeypot", "cybersentil"],
        }
        
        # Remove None values
        elastic_event = {k: v for k, v in elastic_event.items() if v is not None}
        
        return elastic_event

    def _map_severity(self, severity: Any) -> str:
        """
        Map severity to ECS severity levels
        
        Args:
            severity: Severity value (string or number)
            
        Returns:
            ECS severity (low, medium, high, critical)
        """
        severity_map = {
            "critical": "critical",
            "high": "high",
            "medium": "medium",
            "low": "low",
            "info": "low",
        }
        
        if isinstance(severity, int):
            if severity >= 8:
                return "critical"
            elif severity >= 6:
                return "high"
            elif severity >= 4:
                return "medium"
            else:
                return "low"
                
        return severity_map.get(str(severity).lower(), "medium")

    async def test_connection(self) -> bool:
        """
        Test connection to Elastic API
        
        Returns:
            True if connection successful, False otherwise
        """
        if not self.enabled:
            return False

        try:
            async with httpx.AsyncClient(verify=self.verify_tls, timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/",
                    headers=self._get_headers(),
                )
                
                if response.status_code == 200:
                    logger.info("Elastic connection test successful")
                    return True
                else:
                    logger.error(f"Elastic connection test failed: {response.status_code}")
                    return False
                    
        except Exception as exc:
            logger.error(f"Elastic connection test error: {exc}")
            return False


# Global instance
elastic_integration = ElasticIntegration()
