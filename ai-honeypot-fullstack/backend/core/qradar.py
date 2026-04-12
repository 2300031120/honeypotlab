"""
IBM QRadar SIEM Integration
Forwards deception events to IBM QRadar via REST API
"""

import logging
import httpx
from typing import Any, Dict, List, Optional
from datetime import datetime
from core.config import (
    QRADAR_HOST,
    QRADAR_PORT,
    QRADAR_TOKEN,
    QRADAR_VERIFY_TLS,
    QRADAR_TIMEOUT_SECONDS,
)

logger = logging.getLogger(__name__)


class QRadarIntegration:
    """Integration with IBM QRadar SIEM for event forwarding"""

    def __init__(self):
        self.base_url = f"https://{QRADAR_HOST}:{QRADAR_PORT}"
        self.token = QRADAR_TOKEN
        self.verify_tls = QRADAR_VERIFY_TLS
        self.timeout = QRADAR_TIMEOUT_SECONDS
        self.enabled = bool(QRADAR_HOST and QRADAR_TOKEN)

    def _get_headers(self) -> Dict[str, str]:
        """Get authentication headers for QRadar API"""
        return {
            "SEC": self.token,
            "Version": "12.0",
            "Content-Type": "application/json",
        }

    async def forward_event(self, event: Dict[str, Any]) -> bool:
        """
        Forward a single deception event to QRadar
        
        Args:
            event: Event dictionary with deception data
            
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled:
            logger.debug("QRadar integration not enabled")
            return False

        try:
            # Transform event to QRadar format
            qradar_event = self._transform_event(event)
            
            async with httpx.AsyncClient(verify=self.verify_tls, timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/ariel/learners",
                    headers=self._get_headers(),
                    json=qradar_event,
                )
                
                if response.status_code in (200, 201):
                    logger.info(f"Successfully forwarded event to QRadar: {event.get('id')}")
                    return True
                else:
                    logger.error(f"QRadar API error: {response.status_code} - {response.text}")
                    return False
                    
        except httpx.TimeoutException:
            logger.error("QRadar API timeout")
            return False
        except Exception as exc:
            logger.error(f"QRadar integration error: {exc}")
            return False

    async def forward_events_batch(self, events: List[Dict[str, Any]]) -> int:
        """
        Forward multiple events to QRadar in batch
        
        Args:
            events: List of event dictionaries
            
        Returns:
            Number of successfully forwarded events
        """
        if not self.enabled or not events:
            return 0

        success_count = 0
        for event in events:
            if await self.forward_event(event):
                success_count += 1
                
        return success_count

    def _transform_event(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform deception event to QRadar format
        
        Args:
            event: Original deception event
            
        Returns:
            Event in QRadar-compatible format
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
        
        # Map to QRadar event format
        qradar_event = {
            "event_id": str(event_id),
            "event_type": event_type,
            "severity": self._map_severity(severity),
            "source_ip": ip_address,
            "destination_ip": event.get("server_ip", "decoy"),
            "destination_port": event.get("port", 443),
            "protocol": event.get("protocol", "HTTP"),
            "timestamp": timestamp,
            "description": f"Deception event: {event_type} on {url_path}",
            "category": "Deception",
            "device_type": "Honeypot",
            "log_source_type": "CyberSentil Deception",
        }
        
        # Add additional context
        if url_path:
            qradar_event["url_path"] = url_path
            
        if cmd:
            qradar_event["command"] = cmd
            
        if country:
            qradar_event["source_country"] = country
            
        if event.get("attacker_type"):
            qradar_event["attacker_type"] = event["attacker_type"]
            
        if event.get("session_id"):
            qradar_event["session_id"] = str(event["session_id"])
            
        if event.get("reputation"):
            qradar_event["ip_reputation"] = event["reputation"]
            
        return qradar_event

    def _map_severity(self, severity: Any) -> int:
        """
        Map severity string to QRadar numeric severity (1-10)
        
        Args:
            severity: Severity value (string or number)
            
        Returns:
            QRadar severity (1-10, 10 being highest)
        """
        severity_map = {
            "critical": 10,
            "high": 8,
            "medium": 5,
            "low": 2,
            "info": 1,
        }
        
        if isinstance(severity, int):
            return min(max(severity, 1), 10)
            
        return severity_map.get(str(severity).lower(), 5)

    async def test_connection(self) -> bool:
        """
        Test connection to QRadar API
        
        Returns:
            True if connection successful, False otherwise
        """
        if not self.enabled:
            return False

        try:
            async with httpx.AsyncClient(verify=self.verify_tls, timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/ariel/learners",
                    headers=self._get_headers(),
                )
                
                if response.status_code == 200:
                    logger.info("QRadar connection test successful")
                    return True
                else:
                    logger.error(f"QRadar connection test failed: {response.status_code}")
                    return False
                    
        except Exception as exc:
            logger.error(f"QRadar connection test error: {exc}")
            return False


# Global instance
qradar_integration = QRadarIntegration()
