"""Redis caching service."""
import json
from typing import Optional, Any
from datetime import timedelta

import redis

from app.core.config import get_settings


settings = get_settings()

# Redis client (lazy initialization)
_redis_client: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    """Get Redis client. Returns None if Redis is not configured."""
    global _redis_client
    
    if not hasattr(settings, 'redis_url') or not settings.redis_url:
        return None
    
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
            )
            # Test connection
            _redis_client.ping()
        except Exception:
            return None
    
    return _redis_client


class CacheService:
    """Service for caching frequently accessed data."""
    
    # Cache keys
    STATUS_OVERVIEW_KEY = "status:overview"
    COMPONENT_KEY_PREFIX = "component:"
    
    # TTL values
    STATUS_OVERVIEW_TTL = 30  # 30 seconds
    COMPONENT_TTL = 60  # 1 minute
    
    def __init__(self):
        self.redis = get_redis()
    
    @property
    def enabled(self) -> bool:
        """Check if caching is enabled."""
        return self.redis is not None
    
    def get(self, key: str) -> Optional[Any]:
        """Get a cached value."""
        if not self.enabled:
            return None
        
        try:
            data = self.redis.get(key)
            if data:
                return json.loads(data)
        except Exception:
            pass
        return None
    
    def set(self, key: str, value: Any, ttl: int = 60) -> bool:
        """Set a cached value with TTL in seconds."""
        if not self.enabled:
            return False
        
        try:
            self.redis.setex(
                key,
                timedelta(seconds=ttl),
                json.dumps(value, default=str),
            )
            return True
        except Exception:
            return False
    
    def delete(self, key: str) -> bool:
        """Delete a cached value."""
        if not self.enabled:
            return False
        
        try:
            self.redis.delete(key)
            return True
        except Exception:
            return False
    
    def delete_pattern(self, pattern: str) -> bool:
        """Delete all keys matching a pattern."""
        if not self.enabled:
            return False
        
        try:
            keys = self.redis.keys(pattern)
            if keys:
                self.redis.delete(*keys)
            return True
        except Exception:
            return False
    
    # Convenience methods
    def get_status_overview(self) -> Optional[dict]:
        """Get cached status overview."""
        return self.get(self.STATUS_OVERVIEW_KEY)
    
    def set_status_overview(self, data: dict) -> bool:
        """Cache status overview."""
        return self.set(self.STATUS_OVERVIEW_KEY, data, self.STATUS_OVERVIEW_TTL)
    
    def invalidate_status(self) -> bool:
        """Invalidate status overview cache."""
        return self.delete(self.STATUS_OVERVIEW_KEY)
    
    def invalidate_all(self) -> bool:
        """Invalidate all cached data."""
        return self.delete_pattern("status:*")


# Singleton instance
cache = CacheService()
