"""
Redis-based Cache Layer
Provides distributed caching for improved API performance
"""

import json
import logging
from typing import Any, Callable, Optional
from functools import wraps

from core.config import REDIS_URL

logger = logging.getLogger(__name__)


class RedisCache:
    """Redis-based cache implementation for distributed environments"""
    
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
            logger.info("Redis cache initialized successfully")
        except ImportError:
            logger.warning("redis package not installed, falling back to in-memory cache")
            self.redis_client = None
        except Exception as e:
            logger.warning(f"Failed to initialize Redis cache: {e}, falling back to in-memory")
            self.redis_client = None
    
    def is_available(self) -> bool:
        """Check if Redis is available"""
        return self.redis_client is not None
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.is_available():
            return None
        
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL (default 5 minutes)"""
        if not self.is_available():
            return False
        
        try:
            serialized = json.dumps(value, default=str)
            self.redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete value from cache"""
        if not self.is_available():
            return False
        
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    def flush_pattern(self, pattern: str) -> int:
        """Flush all keys matching pattern"""
        if not self.is_available():
            return 0
        
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                return self.redis_client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Cache flush error: {e}")
            return 0
    
    def get_stats(self) -> dict:
        """Get cache statistics"""
        if not self.is_available():
            return {"available": False}
        
        try:
            info = self.redis_client.info()
            return {
                "available": True,
                "connected_clients": info.get("connected_clients", 0),
                "used_memory_human": info.get("used_memory_human", "0"),
                "total_commands_processed": info.get("total_commands_processed", 0),
                "keyspace_hits": info.get("keyspace_hits", 0),
                "keyspace_misses": info.get("keyspace_misses", 0),
            }
        except Exception as e:
            logger.error(f"Cache stats error: {e}")
            return {"available": False, "error": str(e)}


def make_cache_key(*args, **kwargs) -> str:
    """Create a cache key from arguments"""
    import hashlib
    key_parts = [str(arg) for arg in args]
    key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
    return hashlib.md5(":".join(key_parts).encode()).hexdigest()


def cached(ttl: int = 300, prefix: str = ""):
    """Decorator to cache function results"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Skip caching if Redis is not available
            if not redis_cache.is_available():
                return func(*args, **kwargs)
            
            # Create cache key
            key = f"{prefix}:{make_cache_key(func.__name__, *args, **kwargs)}"
            
            # Try to get from cache
            result = redis_cache.get(key)
            if result is not None:
                return result
            
            # Execute function
            result = func(*args, **kwargs)
            
            # Cache result
            if result is not None:
                redis_cache.set(key, result, ttl)
            
            return result
        return wrapper
    return decorator


def cache_invalidate(pattern: str):
    """Decorator to invalidate cache after function execution"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = func(*args, **kwargs)
            
            # Invalidate cache
            if redis_cache.is_available():
                redis_cache.flush_pattern(pattern)
            
            return result
        return wrapper
    return decorator


# Global cache instance
redis_cache = RedisCache()
