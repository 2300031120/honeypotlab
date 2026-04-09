"""
Enhanced Security Module for AI Honeypot System
Provides advanced security features including rate limiting, input validation, and threat detection
"""

import hashlib
import hmac
import ipaddress
import json
import re
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Set, Tuple, Union
from collections import defaultdict, deque
from dataclasses import dataclass
from enum import Enum

import redis.asyncio as redis
from fastapi import HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded


class ThreatLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AttackPattern(Enum):
    SQL_INJECTION = "sql_injection"
    XSS = "xss"
    COMMAND_INJECTION = "command_injection"
    PATH_TRAVERSAL = "path_traversal"
    CSRF = "csrf"
    BRUTE_FORCE = "brute_force"
    DDOS = "ddos"
    RECONNAISSANCE = "reconnaissance"


@dataclass
class SecurityEvent:
    timestamp: datetime
    source_ip: str
    threat_level: ThreatLevel
    attack_pattern: AttackPattern
    details: Dict[str, Any]
    user_agent: str
    request_path: str
    blocked: bool = True


class InputValidator:
    """Advanced input validation and sanitization"""
    
    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)",
        r"(\b(OR|AND)\s+\d+\s*=\s*\d+)",
        r"(['\"];?\s*(OR|AND)\s+['\"]?\d+['\"]?\s*=\s*['\"]?\d+)",
        r"(\b(WAITFOR|DELAY|BENCHMARK|SLEEP)\s*\()",
        r"(\b(INTO\s+OUTFILE|LOAD_FILE|DUMPFILE)\b)",
        r"(\b(XP_|SP_|EXEC|CMDSHELL)\b)",
        r"(--|#|\/\*|\*\/)",
    ]
    
    # XSS patterns
    XSS_PATTERNS = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe[^>]*>",
        r"<object[^>]*>",
        r"<embed[^>]*>",
        r"eval\s*\(",
        r"expression\s*\(",
    ]
    
    # Command injection patterns
    COMMAND_INJECTION_PATTERNS = [
        r"[;&|`$(){}[\]]",
        r"\b(curl|wget|nc|netcat|ssh|ftp|telnet)\b",
        r"\b(rm|mv|cp|cat|ls|ps|kill|chmod|chown)\b",
        r"\b(python|perl|ruby|bash|sh|cmd|powershell)\b",
        r"(\$\{|`|\\$)",
    ]
    
    # Path traversal patterns
    PATH_TRAVERSAL_PATTERNS = [
        r"\.\.[/\\]",
        r"\.\.[/\\]\.\.[/\\]",
        r"%2e%2e%2f",
        r"%2e%2e%5c",
        r"\.\.%2f",
        r"\.\.%5c",
        r"/etc/passwd",
        r"/proc/version",
        r"/windows/system32",
    ]
    
    @classmethod
    def validate_sql_input(cls, input_string: str) -> Tuple[bool, List[str]]:
        """Validate input against SQL injection patterns"""
        threats = []
        input_lower = input_string.lower()
        
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if re.search(pattern, input_lower, re.IGNORECASE):
                threats.append(f"SQL injection pattern detected: {pattern}")
        
        return len(threats) == 0, threats
    
    @classmethod
    def validate_xss_input(cls, input_string: str) -> Tuple[bool, List[str]]:
        """Validate input against XSS patterns"""
        threats = []
        
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, input_string, re.IGNORECASE | re.DOTALL):
                threats.append(f"XSS pattern detected: {pattern}")
        
        return len(threats) == 0, threats
    
    @classmethod
    def validate_command_input(cls, input_string: str) -> Tuple[bool, List[str]]:
        """Validate input against command injection patterns"""
        threats = []
        
        for pattern in cls.COMMAND_INJECTION_PATTERNS:
            if re.search(pattern, input_string, re.IGNORECASE):
                threats.append(f"Command injection pattern detected: {pattern}")
        
        return len(threats) == 0, threats
    
    @classmethod
    def validate_path_input(cls, input_string: str) -> Tuple[bool, List[str]]:
        """Validate input against path traversal patterns"""
        threats = []
        
        for pattern in cls.PATH_TRAVERSAL_PATTERNS:
            if re.search(pattern, input_string, re.IGNORECASE):
                threats.append(f"Path traversal pattern detected: {pattern}")
        
        return len(threats) == 0, threats
    
    @classmethod
    def sanitize_input(cls, input_string: str, max_length: int = 1000) -> str:
        """Sanitize input string"""
        if not input_string:
            return ""
        
        # Remove null bytes and control characters
        sanitized = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', input_string)
        
        # Limit length
        sanitized = sanitized[:max_length]
        
        # Normalize whitespace
        sanitized = re.sub(r'\s+', ' ', sanitized).strip()
        
        return sanitized


class AdvancedRateLimiter:
    """Redis-based advanced rate limiting with multiple strategies"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.limiter = Limiter(key_func=get_remote_address)
    
    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        window_seconds: int,
        strategy: str = "sliding_window"
    ) -> Tuple[bool, int]:
        """
        Check rate limit with different strategies
        
        Args:
            key: Rate limit key
            limit: Maximum requests allowed
            window_seconds: Time window in seconds
            strategy: "sliding_window", "fixed_window", "token_bucket"
        
        Returns:
            Tuple of (allowed, retry_after_seconds)
        """
        now = time.time()
        
        if strategy == "sliding_window":
            return await self._sliding_window_check(key, limit, window_seconds, now)
        elif strategy == "fixed_window":
            return await self._fixed_window_check(key, limit, window_seconds, now)
        elif strategy == "token_bucket":
            return await self._token_bucket_check(key, limit, window_seconds, now)
        else:
            raise ValueError(f"Unknown rate limiting strategy: {strategy}")
    
    async def _sliding_window_check(
        self, key: str, limit: int, window_seconds: int, now: float
    ) -> Tuple[bool, int]:
        """Sliding window rate limiting"""
        window_start = now - window_seconds
        
        # Remove old entries
        await self.redis.zremrangebyscore(key, 0, window_start)
        
        # Count current requests
        current_count = await self.redis.zcard(key)
        
        if current_count >= limit:
            # Get oldest request time for retry calculation
            oldest = await self.redis.zrange(key, 0, 0, withscores=True)
            if oldest:
                retry_after = int(oldest[0][1] + window_seconds - now)
            else:
                retry_after = window_seconds
            return False, max(1, retry_after)
        
        # Add current request
        await self.redis.zadd(key, {str(now): now})
        await self.redis.expire(key, window_seconds)
        
        return True, 0
    
    async def _fixed_window_check(
        self, key: str, limit: int, window_seconds: int, now: float
    ) -> Tuple[bool, int]:
        """Fixed window rate limiting"""
        current_window = int(now // window_seconds)
        window_key = f"{key}:{current_window}"
        
        current_count = await self.redis.get(window_key)
        current_count = int(current_count or 0)
        
        if current_count >= limit:
            retry_after = window_seconds - (int(now) % window_seconds)
            return False, max(1, retry_after)
        
        await self.redis.incr(window_key)
        await self.redis.expire(window_key, window_seconds)
        
        return True, 0
    
    async def _token_bucket_check(
        self, key: str, limit: int, window_seconds: int, now: float
    ) -> Tuple[bool, int]:
        """Token bucket rate limiting"""
        bucket_key = f"{key}:bucket"
        
        # Get current bucket state
        bucket_data = await self.redis.hmget(bucket_key, "tokens", "last_refill")
        tokens = float(bucket_data[0] or limit)
        last_refill = float(bucket_data[1] or now)
        
        # Refill tokens
        time_passed = now - last_refill
        tokens_to_add = (time_passed / window_seconds) * limit
        tokens = min(limit, tokens + tokens_to_add)
        
        if tokens < 1:
            retry_after = int((1 - tokens) * window_seconds / limit)
            return False, max(1, retry_after)
        
        # Consume one token
        tokens -= 1
        
        # Update bucket state
        await self.redis.hmset(bucket_key, {
            "tokens": tokens,
            "last_refill": now
        })
        await self.redis.expire(bucket_key, window_seconds * 2)
        
        return True, 0


class ThreatDetector:
    """Advanced threat detection and analysis"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.validator = InputValidator()
    
    async def analyze_request(
        self, 
        request: Request, 
        request_data: Optional[Dict[str, Any]] = None
    ) -> List[SecurityEvent]:
        """Analyze request for threats"""
        events = []
        source_ip = self._extract_ip(request)
        user_agent = request.headers.get("user-agent", "")
        request_path = request.url.path
        
        # Analyze different parts of the request
        if request_data:
            events.extend(await self._analyze_form_data(
                request_data, source_ip, user_agent, request_path
            ))
        
        events.extend(await self._analyze_query_params(
            request, source_ip, user_agent, request_path
        ))
        
        events.extend(await self._analyze_headers(
            request, source_ip, user_agent, request_path
        ))
        
        events.extend(await self._analyze_behavioral_patterns(
            source_ip, user_agent, request_path
        ))
        
        return events
    
    async def _analyze_form_data(
        self, 
        data: Dict[str, Any], 
        source_ip: str, 
        user_agent: str, 
        request_path: str
    ) -> List[SecurityEvent]:
        """Analyze form data for threats"""
        events = []
        
        for key, value in data.items():
            if isinstance(value, str):
                # SQL Injection
                is_safe, threats = self.validator.validate_sql_input(value)
                if not is_safe:
                    events.append(SecurityEvent(
                        timestamp=datetime.utcnow(),
                        source_ip=source_ip,
                        threat_level=ThreatLevel.HIGH,
                        attack_pattern=AttackPattern.SQL_INJECTION,
                        details={"field": key, "threats": threats},
                        user_agent=user_agent,
                        request_path=request_path
                    ))
                
                # XSS
                is_safe, threats = self.validator.validate_xss_input(value)
                if not is_safe:
                    events.append(SecurityEvent(
                        timestamp=datetime.utcnow(),
                        source_ip=source_ip,
                        threat_level=ThreatLevel.MEDIUM,
                        attack_pattern=AttackPattern.XSS,
                        details={"field": key, "threats": threats},
                        user_agent=user_agent,
                        request_path=request_path
                    ))
                
                # Command Injection
                is_safe, threats = self.validator.validate_command_input(value)
                if not is_safe:
                    events.append(SecurityEvent(
                        timestamp=datetime.utcnow(),
                        source_ip=source_ip,
                        threat_level=ThreatLevel.HIGH,
                        attack_pattern=AttackPattern.COMMAND_INJECTION,
                        details={"field": key, "threats": threats},
                        user_agent=user_agent,
                        request_path=request_path
                    ))
        
        return events
    
    async def _analyze_query_params(
        self, 
        request: Request, 
        source_ip: str, 
        user_agent: str, 
        request_path: str
    ) -> List[SecurityEvent]:
        """Analyze query parameters for threats"""
        events = []
        
        for key, value in request.query_params.items():
            # Path traversal in query params
            is_safe, threats = self.validator.validate_path_input(value)
            if not is_safe:
                events.append(SecurityEvent(
                    timestamp=datetime.utcnow(),
                    source_ip=source_ip,
                    threat_level=ThreatLevel.MEDIUM,
                    attack_pattern=AttackPattern.PATH_TRAVERSAL,
                    details={"param": key, "threats": threats},
                    user_agent=user_agent,
                    request_path=request_path
                ))
        
        return events
    
    async def _analyze_headers(
        self, 
        request: Request, 
        source_ip: str, 
        user_agent: str, 
        request_path: str
    ) -> List[SecurityEvent]:
        """Analyze HTTP headers for threats"""
        events = []
        
        # Check for suspicious user agents
        suspicious_agents = [
            "sqlmap", "nikto", "nmap", "dirb", "gobuster", 
            "wfuzz", "burp", "zap", "masscan", "nuclei"
        ]
        
        agent_lower = user_agent.lower()
        for suspicious in suspicious_agents:
            if suspicious in agent_lower:
                events.append(SecurityEvent(
                    timestamp=datetime.utcnow(),
                    source_ip=source_ip,
                    threat_level=ThreatLevel.MEDIUM,
                    attack_pattern=AttackPattern.RECONNAISSANCE,
                    details={"suspicious_agent": suspicious},
                    user_agent=user_agent,
                    request_path=request_path
                ))
                break
        
        return events
    
    async def _analyze_behavioral_patterns(
        self, 
        source_ip: str, 
        user_agent: str, 
        request_path: str
    ) -> List[SecurityEvent]:
        """Analyze behavioral patterns for threats"""
        events = []
        
        # Check for rapid requests (potential DoS)
        ip_key = f"requests:{source_ip}"
        now = time.time()
        
        # Clean old entries (older than 1 minute)
        await self.redis.zremrangebyscore(ip_key, 0, now - 60)
        
        # Count recent requests
        recent_count = await self.redis.zcard(ip_key)
        
        if recent_count > 100:  # More than 100 requests per minute
            events.append(SecurityEvent(
                timestamp=datetime.utcnow(),
                source_ip=source_ip,
                threat_level=ThreatLevel.HIGH,
                attack_pattern=AttackPattern.DDOS,
                details={"requests_per_minute": recent_count},
                user_agent=user_agent,
                request_path=request_path
            ))
        
        # Add current request
        await self.redis.zadd(ip_key, {str(now): now})
        await self.redis.expire(ip_key, 60)
        
        # Check for reconnaissance patterns
        recon_paths = ["/admin", "/login", "/wp-admin", "/phpmyadmin", "/.env", "/config"]
        if any(path in request_path.lower() for path in recon_paths):
            recon_key = f"recon:{source_ip}"
            recon_count = await self.redis.incr(recon_key)
            await self.redis.expire(recon_key, 3600)  # 1 hour
            
            if recon_count > 5:  # More than 5 recon attempts in hour
                events.append(SecurityEvent(
                    timestamp=datetime.utcnow(),
                    source_ip=source_ip,
                    threat_level=ThreatLevel.MEDIUM,
                    attack_pattern=AttackPattern.RECONNAISSANCE,
                    details={"recon_attempts": recon_count},
                    user_agent=user_agent,
                    request_path=request_path
                ))
        
        return events
    
    def _extract_ip(self, request: Request) -> str:
        """Extract client IP from request"""
        # Check various headers for real IP
        forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip", "").strip()
        
        if forwarded_for:
            return forwarded_for
        elif real_ip:
            return real_ip
        elif request.client:
            return str(request.client.host)
        
        return "unknown"


class SecurityManager:
    """Main security management class"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.rate_limiter = AdvancedRateLimiter(redis_client)
        self.threat_detector = ThreatDetector(redis_client)
    
    async def check_request_security(
        self, 
        request: Request, 
        request_data: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, List[SecurityEvent]]:
        """
        Perform comprehensive security check on request
        
        Returns:
            Tuple of (allowed, security_events)
        """
        # Extract IP for rate limiting
        source_ip = self.threat_detector._extract_ip(request)
        
        # Check rate limits
        rate_limit_key = f"global:{source_ip}"
        allowed, retry_after = await self.rate_limiter.check_rate_limit(
            rate_limit_key, 
            limit=60,  # 60 requests per minute
            window_seconds=60,
            strategy="sliding_window"
        )
        
        if not allowed:
            # Create rate limit event
            event = SecurityEvent(
                timestamp=datetime.utcnow(),
                source_ip=source_ip,
                threat_level=ThreatLevel.MEDIUM,
                attack_pattern=AttackPattern.DDOS,
                details={"retry_after": retry_after},
                user_agent=request.headers.get("user-agent", ""),
                request_path=request.url.path
            )
            return False, [event]
        
        # Analyze for threats
        security_events = await self.threat_detector.analyze_request(request, request_data)
        
        # Determine if request should be blocked
        blocked = False
        for event in security_events:
            if event.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
                blocked = True
                break
        
        # Store security events
        if security_events:
            await self._store_security_events(security_events)
        
        return not blocked, security_events
    
    async def _store_security_events(self, events: List[SecurityEvent]):
        """Store security events in Redis for analysis"""
        for event in events:
            event_key = f"security_event:{event.timestamp.timestamp()}"
            event_data = {
                "timestamp": event.timestamp.isoformat(),
                "source_ip": event.source_ip,
                "threat_level": event.threat_level.value,
                "attack_pattern": event.attack_pattern.value,
                "details": json.dumps(event.details),
                "user_agent": event.user_agent,
                "request_path": event.request_path,
                "blocked": event.blocked
            }
            
            await self.redis.hmset(event_key, event_data)
            await self.redis.expire(event_key, 86400)  # Keep for 24 hours
    
    async def get_security_metrics(
        self, 
        hours: int = 24
    ) -> Dict[str, Any]:
        """Get security metrics for the specified time period"""
        # This is a simplified version - in production you'd want more sophisticated queries
        keys = await self.redis.keys("security_event:*")
        
        metrics = {
            "total_events": len(keys),
            "blocked_requests": 0,
            "threat_levels": defaultdict(int),
            "attack_patterns": defaultdict(int),
            "top_source_ips": defaultdict(int)
        }
        
        for key in keys[:1000]:  # Limit to prevent memory issues
            event_data = await self.redis.hgetall(key)
            if event_data:
                if event_data.get("blocked") == "True":
                    metrics["blocked_requests"] += 1
                
                threat_level = event_data.get("threat_level", "unknown")
                metrics["threat_levels"][threat_level] += 1
                
                attack_pattern = event_data.get("attack_pattern", "unknown")
                metrics["attack_patterns"][attack_pattern] += 1
                
                source_ip = event_data.get("source_ip", "unknown")
                metrics["top_source_ips"][source_ip] += 1
        
        # Sort and limit top IPs
        metrics["top_source_ips"] = dict(
            sorted(metrics["top_source_ips"].items(), 
                  key=lambda x: x[1], reverse=True)[:10]
        )
        
        return metrics


# Security middleware for FastAPI
class SecurityMiddleware:
    """FastAPI middleware for security checks"""
    
    def __init__(self, security_manager: SecurityManager):
        self.security_manager = security_manager
    
    async def __call__(self, request: Request, call_next):
        # Get request data if it's a form POST
        request_data = None
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                if request.headers.get("content-type", "").startswith("application/x-www-form-urlencoded"):
                    request_data = await request.form()
                    request_data = dict(request_data)
            except Exception:
                pass
        
        # Perform security check
        allowed, security_events = await self.security_manager.check_request_security(
            request, request_data
        )
        
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Request blocked by security policy"
            )
        
        # Continue with request
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Security-Events"] = str(len(security_events))
        
        return response
