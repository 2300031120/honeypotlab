"""
AI/Bot Protection Middleware
Blocks known AI crawlers and detects bot behavior patterns
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

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
        # Get user-agent
        user_agent = request.headers.get("user-agent", "").lower()
        
        # Check if user-agent matches blocked patterns
        for blocked_agent in BLOCKED_USER_AGENTS:
            if blocked_agent.lower() in user_agent:
                logger.warning(f"Blocked AI/bot request: {blocked_agent} from {request.client.host}")
                return Response(
                    content="Access denied",
                    status_code=403,
                    media_type="text/plain"
                )
        
        # Check for suspicious patterns
        # No user-agent
        if not user_agent or user_agent == "":
            logger.warning(f"Blocked request with no user-agent from {request.client.host}")
            return Response(
                content="Access denied",
                status_code=403,
                media_type="text/plain"
            )
        
        # Check for curl/wget (common in automated attacks)
        if "curl" in user_agent or "wget" in user_agent or "python" in user_agent:
            # Allow health checks from localhost
            if request.client.host in ["127.0.0.1", "localhost", "::1"]:
                pass
            else:
                logger.warning(f"Blocked automated tool request from {request.client.host}: {user_agent}")
                return Response(
                    content="Access denied",
                    status_code=403,
                    media_type="text/plain"
                )
        
        # Allow request to proceed
        response = await call_next(request)
        
        return response
