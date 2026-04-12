"""
IP Whitelist Middleware
Restricts admin access to whitelisted IP addresses only
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """
    Middleware to restrict admin access to whitelisted IP addresses
    """
    
    def __init__(self, app, whitelist_ips: list[str], admin_paths: list[str]):
        super().__init__(app)
        self.whitelist_ips = [ip.strip() for ip in whitelist_ips if ip.strip()]
        self.admin_paths = admin_paths
        self.whitelist_enabled = len(self.whitelist_ips) > 0
    
    async def dispatch(self, request: Request, call_next):
        # Skip if whitelist not enabled
        if not self.whitelist_enabled:
            return await call_next(request)
        
        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        
        # Check if request is to admin path
        is_admin_request = any(
            request.url.path.startswith(path) for path in self.admin_paths
        )
        
        # Skip if not admin request
        if not is_admin_request:
            return await call_next(request)
        
        # Allow localhost for development
        if client_ip in ["127.0.0.1", "localhost", "::1"]:
            return await call_next(request)
        
        # Check if IP is whitelisted
        is_whitelisted = self._is_ip_whitelisted(client_ip)
        
        if not is_whitelisted:
            logger.warning(f"Admin access denied for IP {client_ip} to path {request.url.path}")
            return Response(
                content="Access denied - IP not whitelisted",
                status_code=403,
                media_type="text/plain"
            )
        
        # Allow request to proceed
        return await call_next(request)
    
    def _is_ip_whitelisted(self, ip: str) -> bool:
        """Check if IP is in whitelist"""
        if not self.whitelist_ips:
            return True  # No whitelist configured, allow all
        
        # Check exact match
        if ip in self.whitelist_ips:
            return True
        
        # Check CIDR ranges (simplified - exact match for now)
        # For full CIDR support, use ipaddress module
        for whitelist_ip in self.whitelist_ips:
            if whitelist_ip.endswith("/24"):
                # Simple /24 subnet check
                network = whitelist_ip.split("/")[0]
                if ip.startswith(".".join(network.split(".")[:-1])):
                    return True
        
        return False
