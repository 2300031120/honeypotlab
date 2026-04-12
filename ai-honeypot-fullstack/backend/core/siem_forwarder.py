"""
Unified SIEM Forwarder
Forwards deception events to all configured SIEM platforms (Splunk, QRadar, Elastic, Sentinel)
"""

import logging
import threading
from typing import Any, Dict, List

from core.splunk import forward_event_to_splunk
from core.qradar import qradar_integration
from core.elastic import elastic_integration
from core.sentinel import sentinel_integration

logger = logging.getLogger(__name__)


class SIEMForwarder:
    """Unified forwarder for all SIEM integrations"""

    def __init__(self):
        self.splunk_enabled = False
        self.qradar_enabled = qradar_integration.enabled
        self.elastic_enabled = elastic_integration.enabled
        self.sentinel_enabled = sentinel_integration.enabled

    async def forward_event(self, event: Dict[str, Any], *, background: bool = True) -> int:
        """
        Forward event to all configured SIEM platforms
        
        Args:
            event: Event dictionary with deception data
            background: Whether to forward in background thread
            
        Returns:
            Number of SIEMs successfully forwarded to
        """
        success_count = 0

        # Forward to Splunk
        if forward_event_to_splunk(event, background=background):
            success_count += 1

        # Forward to QRadar
        if self.qradar_enabled:
            try:
                if background:
                    # Run in background thread
                    thread = threading.Thread(
                        target=lambda: self._forward_to_qradar(event),
                        name="qradar-forward",
                        daemon=True,
                    )
                    thread.start()
                    success_count += 1
                else:
                    if await qradar_integration.forward_event(event):
                        success_count += 1
            except Exception as exc:
                logger.error(f"QRadar forwarding error: {exc}")

        # Forward to Elastic
        if self.elastic_enabled:
            try:
                if background:
                    thread = threading.Thread(
                        target=lambda: self._forward_to_elastic(event),
                        name="elastic-forward",
                        daemon=True,
                    )
                    thread.start()
                    success_count += 1
                else:
                    if await elastic_integration.forward_event(event):
                        success_count += 1
            except Exception as exc:
                logger.error(f"Elastic forwarding error: {exc}")

        # Forward to Sentinel
        if self.sentinel_enabled:
            try:
                if background:
                    thread = threading.Thread(
                        target=lambda: self._forward_to_sentinel(event),
                        name="sentinel-forward",
                        daemon=True,
                    )
                    thread.start()
                    success_count += 1
                else:
                    if await sentinel_integration.forward_event(event):
                        success_count += 1
            except Exception as exc:
                logger.error(f"Sentinel forwarding error: {exc}")

        return success_count

    def _forward_to_qradar(self, event: Dict[str, Any]) -> None:
        """Forward to QRadar in background thread"""
        import asyncio
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(qradar_integration.forward_event(event))
        except Exception as exc:
            logger.error(f"QRadar background forwarding error: {exc}")
        finally:
            loop.close()

    def _forward_to_elastic(self, event: Dict[str, Any]) -> None:
        """Forward to Elastic in background thread"""
        import asyncio
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(elastic_integration.forward_event(event))
        except Exception as exc:
            logger.error(f"Elastic background forwarding error: {exc}")
        finally:
            loop.close()

    def _forward_to_sentinel(self, event: Dict[str, Any]) -> None:
        """Forward to Sentinel in background thread"""
        import asyncio
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(sentinel_integration.forward_event(event))
        except Exception as exc:
            logger.error(f"Sentinel background forwarding error: {exc}")
        finally:
            loop.close()

    async def forward_events_batch(self, events: List[Dict[str, Any]]) -> int:
        """
        Forward multiple events to all configured SIEM platforms
        
        Args:
            events: List of event dictionaries
            
        Returns:
            Total number of successful forwards
        """
        total_success = 0

        # Splunk doesn't have batch API, forward individually
        for event in events:
            if forward_event_to_splunk(event, background=False):
                total_success += 1

        # QRadar batch
        if self.qradar_enabled:
            try:
                total_success += await qradar_integration.forward_events_batch(events)
            except Exception as exc:
                logger.error(f"QRadar batch forwarding error: {exc}")

        # Elastic batch (has bulk API)
        if self.elastic_enabled:
            try:
                total_success += await elastic_integration.forward_events_batch(events)
            except Exception as exc:
                logger.error(f"Elastic batch forwarding error: {exc}")

        # Sentinel batch (no bulk API, forward individually)
        if self.sentinel_enabled:
            try:
                total_success += await sentinel_integration.forward_events_batch(events)
            except Exception as exc:
                logger.error(f"Sentinel batch forwarding error: {exc}")

        return total_success

    async def test_connections(self) -> Dict[str, bool]:
        """
        Test connections to all configured SIEM platforms
        
        Returns:
            Dictionary mapping SIEM name to connection status
        """
        results = {}

        # Test Splunk
        results["splunk"] = forward_event_to_splunk({}, background=False)

        # Test QRadar
        if self.qradar_enabled:
            results["qradar"] = await qradar_integration.test_connection()
        else:
            results["qradar"] = False

        # Test Elastic
        if self.elastic_enabled:
            results["elastic"] = await elastic_integration.test_connection()
        else:
            results["elastic"] = False

        # Test Sentinel
        if self.sentinel_enabled:
            results["sentinel"] = await sentinel_integration.test_connection()
        else:
            results["sentinel"] = False

        return results

    def get_status(self) -> Dict[str, Any]:
        """
        Get status of all SIEM integrations
        
        Returns:
            Dictionary with SIEM status information
        """
        return {
            "splunk": {"enabled": True},  # Splunk always enabled if configured
            "qradar": {"enabled": self.qradar_enabled},
            "elastic": {"enabled": self.elastic_enabled},
            "sentinel": {"enabled": self.sentinel_enabled},
            "total_enabled": sum([
                1,  # Splunk
                1 if self.qradar_enabled else 0,
                1 if self.elastic_enabled else 0,
                1 if self.sentinel_enabled else 0,
            ]),
        }


# Global instance
siem_forwarder = SIEMForwarder()
