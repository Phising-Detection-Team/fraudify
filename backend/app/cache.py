"""
Scan result cache module.

Provides a content-addressed Redis cache for phishing scan verdicts.
Cache keys are derived from email subject + body (SHA-256), so the same
content always maps to the same key regardless of which user submitted it.

Redis errors are treated as cache misses — a Redis outage must never
cause scan failures.
"""

import json
import hashlib
from typing import Optional

_redis_client = None


def get_redis():
    """Lazy Redis connection — reuses the app's configured REDIS_URL."""
    global _redis_client
    if _redis_client is None:
        import redis
        from flask import current_app
        url = current_app.config.get('REDIS_URL', 'redis://localhost:6379/0')
        _redis_client = redis.from_url(url, decode_responses=True)
    return _redis_client


def make_scan_cache_key(subject: str, body: str) -> str:
    """
    Content-addressed cache key — same email content always maps to same key.

    Normalises whitespace at both ends before hashing so trailing spaces
    or newlines don't create spurious misses.
    """
    normalized = f"{subject.strip()}\n\n{body.strip()}"
    return f"scan:v1:{hashlib.sha256(normalized.encode()).hexdigest()}"


def get_scan_cache(subject: str, body: str) -> Optional[dict]:
    """
    Return cached verdict dict or None on cache miss / Redis error.

    Never raises — Redis unavailability is handled transparently.
    """
    try:
        key = make_scan_cache_key(subject, body)
        raw = get_redis().get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None  # Redis unavailable → treat as miss


def set_scan_cache(subject: str, body: str, result: dict, ttl: int = 3600) -> None:
    """
    Store verdict dict in Redis with a TTL.

    Silently ignores all errors — Redis unavailability must not block scans.
    """
    try:
        key = make_scan_cache_key(subject, body)
        get_redis().setex(key, ttl, json.dumps(result))
    except Exception:
        pass  # Redis unavailable → non-fatal


def get_cache_stats() -> dict:
    """
    Return basic stats about the scan cache.

    Returns:
        cached_keys  (int):  number of keys matching the scan:v1:* prefix
        available    (bool): False when Redis is unreachable
    """
    try:
        r = get_redis()
        keys = r.keys('scan:v1:*')
        return {'cached_keys': len(keys), 'available': True}
    except Exception:
        return {'cached_keys': 0, 'available': False}
