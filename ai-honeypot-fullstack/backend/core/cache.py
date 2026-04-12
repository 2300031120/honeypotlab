"""
API Response Caching Module
Provides caching functionality for improved API performance
"""

import json
import hashlib
import time
from typing import Any, Callable, Optional
from functools import wraps
from core.database import db


class CacheManager:
    """Simple in-memory cache with optional database persistence"""
    
    def __init__(self, default_ttl: int = 300):
        self._cache: dict[str, dict[str, Any]] = {}
        self.default_ttl = default_ttl
    
    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate a cache key from function arguments"""
        key_data = f"{prefix}:{args}:{sorted(kwargs.items())}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        if key in self._cache:
            entry = self._cache[key]
            if time.time() < entry["expires_at"]:
                return entry["value"]
            else:
                del self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with TTL"""
        ttl = ttl if ttl is not None else self.default_ttl
        self._cache[key] = {
            "value": value,
            "expires_at": time.time() + ttl,
            "created_at": time.time()
        }
    
    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    def clear(self) -> None:
        """Clear all cache entries"""
        self._cache.clear()
    
    def cleanup_expired(self) -> int:
        """Remove expired entries, return count removed"""
        now = time.time()
        expired_keys = [k for k, v in self._cache.items() if v["expires_at"] < now]
        for key in expired_keys:
            del self._cache[key]
        return len(expired_keys)
    
    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics"""
        now = time.time()
        total = len(self._cache)
        expired = sum(1 for v in self._cache.values() if v["expires_at"] < now)
        return {
            "total_entries": total,
            "expired_entries": expired,
            "active_entries": total - expired,
            "hit_rate": getattr(self, "_hits", 0) / max(1, getattr(self, "_misses", 0) + getattr(self, "_hits", 0))
        }


# Global cache instance
cache_manager = CacheManager(default_ttl=300)


def cached_response(prefix: str, ttl: Optional[int] = None):
    """
    Decorator to cache function responses
    
    Args:
        prefix: Prefix for cache key generation
        ttl: Time to live in seconds (uses default if not specified)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            key = cache_manager._generate_key(prefix, *args, **kwargs)
            
            # Try to get from cache
            cached = cache_manager.get(key)
            if cached is not None:
                cache_manager._hits = getattr(cache_manager, "_hits", 0) + 1
                return cached
            
            # Execute function
            cache_manager._misses = getattr(cache_manager, "_misses", 0) + 1
            result = func(*args, **kwargs)
            
            # Cache result
            cache_manager.set(key, result, ttl)
            
            return result
        return wrapper
    return decorator


def invalidate_cache_pattern(prefix: str) -> int:
    """
    Invalidate all cache entries matching a prefix pattern
    
    Args:
        prefix: Prefix to match
    
    Returns:
        Number of entries invalidated
    """
    count = 0
    keys_to_delete = []
    
    for key in cache_manager._cache.keys():
        if key.startswith(prefix):
            keys_to_delete.append(key)
    
    for key in keys_to_delete:
        cache_manager.delete(key)
        count += 1
    
    return count


def get_telemetry_cache_key(user_id: int, hours: int = 24) -> str:
    """Generate cache key for telemetry data"""
    return cache_manager._generate_key(f"telemetry:{user_id}", hours=hours)


def get_intelligence_cache_key(user_id: int) -> str:
    """Generate cache key for intelligence data"""
    return cache_manager._generate_key(f"intelligence:{user_id}")


def get_site_cache_key(site_id: int) -> str:
    """Generate cache key for site configuration"""
    return cache_manager._generate_key(f"site:{site_id}")


def cache_telemetry_summary(user_id: int, summary: dict[str, Any], ttl: int = 60) -> None:
    """Cache telemetry summary for a user"""
    key = get_telemetry_cache_key(user_id)
    cache_manager.set(key, summary, ttl)


def get_cached_telemetry_summary(user_id: int) -> Optional[dict[str, Any]]:
    """Get cached telemetry summary for a user"""
    key = get_telemetry_cache_key(user_id)
    return cache_manager.get(key)


def cache_intelligence_data(user_id: int, data: dict[str, Any], ttl: int = 120) -> None:
    """Cache intelligence data for a user"""
    key = get_intelligence_cache_key(user_id)
    cache_manager.set(key, data, ttl)


def get_cached_intelligence_data(user_id: int) -> Optional[dict[str, Any]]:
    """Get cached intelligence data for a user"""
    key = get_intelligence_cache_key(user_id)
    return cache_manager.get(key)


def invalidate_user_cache(user_id: int) -> int:
    """Invalidate all cache entries for a specific user"""
    count = 0
    keys_to_delete = []
    
    for key in cache_manager._cache.keys():
        if f":{user_id}:" in key or key.endswith(f":{user_id}"):
            keys_to_delete.append(key)
    
    for key in keys_to_delete:
        cache_manager.delete(key)
        count += 1
    
    return count


def cleanup_cache_periodically() -> dict[str, Any]:
    """Periodic cache cleanup task"""
    removed = cache_manager.cleanup_expired()
    stats = cache_manager.get_stats()
    return {
        "removed_entries": removed,
        "stats": stats
    }


def cache_result(ttl: Optional[int] = None, key_prefix: str = ""):
    """
    Decorator to cache function results (alias for cached_response)
    
    Args:
        ttl: Time to live in seconds (uses default if not specified)
        key_prefix: Prefix for cache key generation
    
    This is an alias for cached_response with parameter names swapped for compatibility
    """
    return cached_response(prefix=key_prefix, ttl=ttl)
