"""
AI/Bot Protection Middleware
Blocks known AI crawlers and detects bot behavior patterns
"""
from __future__ import annotations

import ipaddress
import logging
import os

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Configurable allowlist for legitimate monitoring tools
ALLOWED_TOOLS_CSV = os.getenv("AI_PROTECTION_ALLOWED_TOOLS", "")
ALLOWED_TOOLS = {tool.strip().lower() for tool in ALLOWED_TOOLS_CSV.split(",") if tool.strip()}

# Probe/decoy paths must stay reachable; blocking scanners here defeats the product.
DECOY_BYPASS_PATHS = frozenset(
    {
        "/admin",
        "/admin/login",
        "/admin/portal",
        "/administrator",
        "/wp-admin",
        "/wp-admin/",
        "/wp-login.php",
        "/xmlrpc.php",
        "/phpmyadmin",
        "/phpmyadmin/",
        "/config.php",
        "/.env",
        "/.git",
        "/.git/config",
        "/api/config",
        "/api/secret",
        "/api/admin",
        "/api/users",
        "/api/database",
        "/api/v1/users",
        "/actuator/env",
        "/backup",
        "/backups",
        "/console",
        "/debug",
        "/test",
        "/login.php",
        "/robots.txt",
    }
)

# External uptime monitors often use curl/python; keep health probes open.
HEALTH_BYPASS_PATHS = frozenset({"/health", "/health/detailed", "/api/health", "/api/health/detailed"})


def _client_host(request: Request) -> str:
    if request.client and request.client.host:
        return str(request.client.host)
    return "unknown"


def _is_private_or_local(host: str) -> bool:
    if host in {"127.0.0.1", "localhost", "::1", "unknown"}:
        return host != "unknown"
    try:
        parsed = ipaddress.ip_address(host)
    except ValueError:
        return False
    return bool(parsed.is_private or parsed.is_loopback or parsed.is_link_local)


# Known AI/bot user-agents to block
BLOCKED_USER_AGENTS = [
    # OpenAI
    "GPTBot",
    "ChatGPT",
    "GPT-",
    # Anthropic
    "Claude-Web",
    "Claude/",
    # Google AI
    "GoogleOther",
    "Googlebot-Image",
    "Googlebot-Video",
    # Common AI scrapers
    "AI2Bot",
    "Amazonbot",
    "Applebot",
    "Bingbot",
    "Bytespider",
    "CCBot",
    "Coc Coc",
    "DotBot",
    "DuckDuckBot",
    "FacebookBot",
    "facebookexternalhit",
    "ia_archiver",
    "MJ12bot",
    "PetalBot",
    "PerplexityBot",
    "SemrushBot",
    "Slurp",
    "Twitterbot",
    "YandexBot",
    "YandexImages",
    # AI research tools
    "Anthropic-",
    "OpenAI-",
    "Perplexity-",
    # Headless browsers (often used by bots)
    "HeadlessChrome",
    "PhantomJS",
    "Selenium",
]


class AIProtectionMiddleware(BaseHTTPMiddleware):
    """
    Middleware to block known AI/bot user-agents and detect suspicious behavior
    """
    
    async def dispatch(self, request: Request, call_next):
        path = request.url.path or ""
        client_ip = _client_host(request)

        # Honeypot decoys and health probes must remain reachable to scanners/monitors.
        if (
            path in DECOY_BYPASS_PATHS
            or path in HEALTH_BYPASS_PATHS
            or path.startswith("/phpmyadmin/")
            or path.startswith("/wp-admin/")
        ):
            return await call_next(request)

        user_agent = request.headers.get("user-agent", "").lower()

        for blocked_agent in BLOCKED_USER_AGENTS:
            if blocked_agent.lower() in user_agent:
                logger.warning("Blocked AI/bot request: %s from %s", blocked_agent, client_ip)
                return Response(content="Access denied", status_code=403, media_type="text/plain")

        if not user_agent:
            logger.warning("Blocked request with no user-agent from %s", client_ip)
            return Response(content="Access denied", status_code=403, media_type="text/plain")

        if "curl" in user_agent or "wget" in user_agent or "python" in user_agent:
            tool_name = "curl" if "curl" in user_agent else "wget" if "wget" in user_agent else "python"
            if tool_name in ALLOWED_TOOLS or _is_private_or_local(client_ip):
                return await call_next(request)

            logger.warning("Blocked automated tool request from %s: %s", client_ip, user_agent)
            return Response(content="Access denied", status_code=403, media_type="text/plain")

        return await call_next(request)
