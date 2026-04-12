"""
Request Fingerprinting Middleware
Detects bot/AI behavior patterns by analyzing request characteristics
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
import hashlib
import logging
import time
from typing import Dict, Set

logger = logging.getLogger(__name__)

# Track request patterns per IP
# Structure: {ip: {'requests': [], 'patterns': set(), 'last_seen': timestamp}}
request_tracker: Dict[str, Dict] = defaultdict(lambda: {
    'requests': [],
    'patterns': set(),
    'last_seen': time.time()
})

# Suspicious patterns
SUSPICIOUS_PATTERNS = [
    'sequential_paths',  # Accessing paths in sequence
    'constant_timing',  # Requests at constant intervals
    'no_referer',  # No referer header
    'missing_headers',  # Missing common headers
    'user_agent_rotation',  # Rotating user-agents
]

# Thresholds
MAX_REQUESTS_PER_MINUTE = 30
CONSTANT_TIMING_THRESHOLD = 0.5  # seconds
PATTERN_DETECTION_WINDOW = 60  # seconds


class RequestFingerprintingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to detect bot/AI behavior through request pattern analysis
    """
    
    def __init__(self, app, enable_blocking: bool = True):
        super().__init__(app)
        self.enable_blocking = enable_blocking
    
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "")
        referer = request.headers.get("referer", "")
        accept = request.headers.get("accept", "")
        accept_language = request.headers.get("accept-language", "")
        
        # Skip health checks
        if request.url.path == "/health":
            return await call_next(request)
        
        # Skip localhost
        if client_ip in ["127.0.0.1", "localhost", "::1"]:
            return await call_next(request)
        
        # Generate request fingerprint
        fingerprint = self._generate_fingerprint(
            client_ip, user_agent, request.url.path, accept, accept_language
        )
        
        # Track request
        now = time.time()
        tracker = request_tracker[client_ip]
        
        # Clean old requests
        tracker['requests'] = [r for r in tracker['requests'] if now - r['time'] < PATTERN_DETECTION_WINDOW]
        
        # Add current request
        tracker['requests'].append({
            'path': request.url.path,
            'time': now,
            'fingerprint': fingerprint,
            'user_agent': user_agent,
            'referer': referer
        })
        tracker['last_seen'] = now
        
        # Analyze patterns
        suspicious = self._analyze_patterns(tracker, now)
        
        if suspicious and self.enable_blocking:
            logger.warning(f"Blocked suspicious behavior from {client_ip}: {suspicious}")
            return Response(
                content="Access denied - suspicious behavior detected",
                status_code=403,
                media_type="text/plain"
            )
        
        # Allow request to proceed
        response = await call_next(request)
        
        return response
    
    def _generate_fingerprint(self, ip: str, user_agent: str, path: str, accept: str, accept_language: str) -> str:
        """Generate a unique fingerprint for the request"""
        data = f"{ip}:{user_agent}:{accept}:{accept_language}"
        return hashlib.md5(data.encode()).hexdigest()[:16]
    
    def _analyze_patterns(self, tracker: Dict, now: float) -> Set[str]:
        """Analyze request patterns for suspicious behavior"""
        suspicious = set()
        requests = tracker['requests']
        
        if len(requests) < 3:
            return suspicious
        
        # Check request rate
        if len(requests) > MAX_REQUESTS_PER_MINUTE:
            suspicious.add('high_request_rate')
        
        # Check for constant timing (bot behavior)
        if len(requests) >= 3:
            timings = [requests[i+1]['time'] - requests[i]['time'] for i in range(len(requests)-1)]
            if len(timings) >= 2:
                avg_timing = sum(timings) / len(timings)
                deviations = [abs(t - avg_timing) for t in timings]
                if all(d < CONSTANT_TIMING_THRESHOLD for d in deviations):
                    suspicious.add('constant_timing')
        
        # Check for sequential path access
        if len(requests) >= 3:
            paths = [r['path'] for r in requests]
            # Check if paths are being accessed in a systematic way
            path_variety = len(set(paths))
            if path_variety > 5 and len(requests) > path_variety:
                suspicious.add('sequential_paths')
        
        # Check for no referer on non-health endpoints
        no_referer_count = sum(1 for r in requests if not r['referer'])
        if no_referer_count > len(requests) * 0.8:
            suspicious.add('no_referer')
        
        # Check for missing common headers
        missing_headers_count = sum(1 for r in requests if not r.get('has_common_headers', True))
        if missing_headers_count > len(requests) * 0.5:
            suspicious.add('missing_headers')
        
        # Check for user-agent rotation
        user_agents = set(r['user_agent'] for r in requests)
        if len(user_agents) > 1 and len(requests) > 2:
            suspicious.add('user_agent_rotation')
        
        return suspicious
