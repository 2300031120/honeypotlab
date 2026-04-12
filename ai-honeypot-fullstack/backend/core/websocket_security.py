import asyncio
import logging
from collections import defaultdict
from typing import Any
from datetime import datetime, timedelta

from fastapi import WebSocket, WebSocketException, status
from fastapi.websockets import WebSocketState

from core.config import CORS_ORIGINS
from core.request_security import extract_client_ip
from core.time_utils import utc_now

logger = logging.getLogger(__name__)

# WebSocket security configuration
WS_MAX_CONNECTIONS_PER_IP = 10
WS_MAX_MESSAGE_SIZE = 1_048_576  # 1MB
WS_MESSAGE_RATE_LIMIT = 30  # messages per minute
WS_CONNECTION_TIMEOUT = 3600  # 1 hour
WS_PING_INTERVAL = 30  # seconds
WS_PING_TIMEOUT = 10  # seconds


class WebSocketSecurityManager:
    """Manages WebSocket connection security"""
    
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = defaultdict(list)
        self.message_counts: dict[str, list[datetime]] = defaultdict(list)
        self.connection_timestamps: dict[WebSocket, datetime] = {}
    
    def get_connection_key(self, websocket: WebSocket) -> str:
        """Get a unique key for a WebSocket connection (based on client IP)"""
        return extract_client_ip(websocket)
    
    async def check_connection_limit(self, websocket: WebSocket) -> None:
        """Check if IP has exceeded connection limit"""
        client_ip = self.get_connection_key(websocket)
        connections = self.active_connections[client_ip]
        
        # Clean up closed connections
        connections[:] = [ws for ws in connections if ws.client_state != WebSocketState.DISCONNECTED]
        
        if len(connections) >= WS_MAX_CONNECTIONS_PER_IP:
            logger.warning(f"WebSocket connection limit exceeded for IP: {client_ip}")
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Connection limit exceeded. Please wait before connecting again."
            )
    
    async def check_message_rate(self, websocket: WebSocket) -> None:
        """Check if connection has exceeded message rate limit"""
        client_ip = self.get_connection_key(websocket)
        now = utc_now()
        one_minute_ago = now - timedelta(minutes=1)
        
        # Clean up old message timestamps
        self.message_counts[client_ip] = [
            ts for ts in self.message_counts[client_ip] if ts > one_minute_ago
        ]
        
        if len(self.message_counts[client_ip]) >= WS_MESSAGE_RATE_LIMIT:
            logger.warning(f"WebSocket message rate limit exceeded for IP: {client_ip}")
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Message rate limit exceeded. Please slow down."
            )
    
    def record_message(self, websocket: WebSocket) -> None:
        """Record a message from a connection"""
        client_ip = self.get_connection_key(websocket)
        self.message_counts[client_ip].append(utc_now())
    
    def add_connection(self, websocket: WebSocket) -> None:
        """Add a new connection"""
        client_ip = self.get_connection_key(websocket)
        self.active_connections[client_ip].append(websocket)
        self.connection_timestamps[websocket] = utc_now()
    
    def remove_connection(self, websocket: WebSocket) -> None:
        """Remove a connection"""
        client_ip = self.get_connection_key(websocket)
        if websocket in self.active_connections[client_ip]:
            self.active_connections[client_ip].remove(websocket)
        if websocket in self.connection_timestamps:
            del self.connection_timestamps[websocket]
    
    async def check_connection_timeout(self, websocket: WebSocket) -> None:
        """Check if connection has exceeded timeout"""
        if websocket in self.connection_timestamps:
            connection_age = (utc_now() - self.connection_timestamps[websocket]).total_seconds()
            if connection_age > WS_CONNECTION_TIMEOUT:
                logger.warning(f"WebSocket connection timeout for IP: {self.get_connection_key(websocket)}")
                await websocket.close(
                    code=status.WS_1008_POLICY_VIOLATION,
                    reason="Connection timeout exceeded."
                )
    
    async def validate_origin(self, websocket: WebSocket) -> None:
        """Validate WebSocket origin"""
        origin = websocket.headers.get("origin", "")
        if not origin:
            # Allow connections without origin for non-browser clients
            return
        
        # Check if origin is in allowed CORS origins
        allowed_origins = CORS_ORIGINS or ["*"]
        if "*" in allowed_origins:
            return
        
        # Simple origin validation
        for allowed_origin in allowed_origins:
            if origin == allowed_origin or origin.startswith(allowed_origin):
                return
        
        logger.warning(f"WebSocket origin validation failed: {origin}")
        raise WebSocketException(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Origin not allowed."
        )
    
    async def validate_message_size(self, message: Any) -> None:
        """Validate message size"""
        message_str = str(message)
        if len(message_str) > WS_MAX_MESSAGE_SIZE:
            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Message too large."
            )
    
    async def send_ping(self, websocket: WebSocket) -> None:
        """Send periodic ping to keep connection alive"""
        while websocket.client_state == WebSocketState.CONNECTED:
            try:
                await asyncio.wait_for(
                    websocket.send_json({"type": "ping", "ts": utc_now().isoformat()}),
                    timeout=WS_PING_TIMEOUT
                )
                await asyncio.sleep(WS_PING_INTERVAL)
            except asyncio.TimeoutError:
                logger.warning("WebSocket ping timeout, closing connection")
                await websocket.close(
                    code=status.WS_1008_POLICY_VIOLATION,
                    reason="Ping timeout."
                )
                break
            except Exception as e:
                logger.error(f"WebSocket ping error: {e}")
                break


# Global security manager instance
ws_security_manager = WebSocketSecurityManager()


async def secure_websocket_accept(websocket: WebSocket) -> None:
    """Apply all WebSocket security checks before accepting connection"""
    # Validate origin
    await ws_security_manager.validate_origin(websocket)
    
    # Check connection limit
    await ws_security_manager.check_connection_limit(websocket)
    
    # Accept connection
    await websocket.accept()
    
    # Add to active connections
    ws_security_manager.add_connection(websocket)


async def secure_websocket_message(websocket: WebSocket, message: Any) -> None:
    """Apply security checks to incoming WebSocket message"""
    # Validate message size
    await ws_security_manager.validate_message_size(message)
    
    # Check message rate
    await ws_security_manager.check_message_rate(websocket)
    
    # Record message
    ws_security_manager.record_message(websocket)


async def cleanup_websocket(websocket: WebSocket) -> None:
    """Clean up WebSocket connection"""
    ws_security_manager.remove_connection(websocket)
