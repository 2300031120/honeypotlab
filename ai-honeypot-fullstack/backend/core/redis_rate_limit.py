"""
Redis-based Distributed Rate Limiting
Implements rate limiting using Redis for horizontal scalability
"""

import logging
import time
from typing import Optional
from core.config import REDIS_URL

logger = logging.getLogger(__name__)

class RedisRateLimiter:
    """Redis-based rate limiter for distributed environments"""
    
    def __init__(self):
        self.redis_client = None
        self._init_redis()
    
    def _init_redis(self):
        """Initialize Redis client"""
        try:
            import redis
            self.redis_client = redis.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Redis rate limiter initialized successfully")
        except ImportError:
            logger.warning("redis package not installed, falling back to in-memory rate limiting")
            self.redis_client = None
        except Exception as e:
            logger.warning(f"Failed to initialize Redis rate limiter: {e}, falling back to in-memory")
            self.redis_client = None
    
    def is_allowed(
        self,
        key: str,
        max_attempts: int,
        window_seconds: int
    ) -> tuple[bool, Optional[int]]:
        """
        Check if request is allowed based on rate limit
        
        Args:
            key: Unique identifier for the rate limit (e.g., IP, user_id)
            max_attempts: Maximum number of attempts allowed
            window_seconds: Time window in seconds
        
        Returns:
            tuple of (allowed: bool, remaining_attempts: Optional[int])
        """
        if not self.redis_client:
            # Fallback to in-memory (shouldn't happen in production)
            return True, max_attempts - 1
        
        try:
            current_time = int(time.time())
            window_start = current_time - window_seconds
            
            # Use Redis pipeline for atomic operations
            pipe = self.redis_client.pipeline()
            
            # Remove old entries outside the window
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current attempts
            pipe.zcard(key)
            
            # Add current attempt
            pipe.zadd(key, {str(current_time): current_time})
            
            # Set expiration
            pipe.expire(key, window_seconds)
            
            # Execute pipeline
            results = pipe.execute()
            
            current_attempts = results[1]
            
            if current_attempts > max_attempts:
                # Rate limit exceeded
                return False, 0
            
            remaining = max_attempts - current_attempts
            return True, remaining
            
        except Exception as e:
            logger.error(f"Redis rate limit check failed: {e}")
            # Fail open - allow request if Redis fails
            return True, max_attempts - 1
    
    def reset(self, key: str):
        """Reset rate limit for a specific key"""
        if not self.redis_client:
            return
        
        try:
            self.redis_client.delete(key)
            logger.info(f"Rate limit reset for key: {key}")
        except Exception as e:
            logger.error(f"Failed to reset rate limit: {e}")
    
    def get_stats(self, key: str, window_seconds: int) -> dict:
        """Get current rate limit statistics"""
        if not self.redis_client:
            return {"attempts": 0, "remaining": 0}
        
        try:
            current_time = int(time.time())
            window_start = current_time - window_seconds
            
            # Remove old entries
            self.redis_client.zremrangebyscore(key, 0, window_start)
            
            # Count current attempts
            attempts = self.redis_client.zcard(key)
            
            return {
                "attempts": attempts,
                "remaining": max(0, 10 - attempts)  # Default max is 10
            }
        except Exception as e:
            logger.error(f"Failed to get rate limit stats: {e}")
            return {"attempts": 0, "remaining": 0}


# Global rate limiter instance
rate_limiter = RedisRateLimiter()


def check_rate_limit(
    identifier: str,
    action: str,
    max_attempts: int,
    window_seconds: int
) -> tuple[bool, Optional[int]]:
    """
    Check rate limit for a specific action
    
    Args:
        identifier: Unique identifier (IP, user_id, etc.)
        action: Action type (login, signup, etc.)
        max_attempts: Maximum attempts allowed
        window_seconds: Time window in seconds
    
    Returns:
        tuple of (allowed: bool, remaining_attempts: Optional[int])
    """
    key = f"rate_limit:{action}:{identifier}"
    return rate_limiter.is_allowed(key, max_attempts, window_seconds)
