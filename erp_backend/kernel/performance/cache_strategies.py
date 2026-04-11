"""
Advanced Caching Strategies
============================
Multi-layer caching system for maximum performance.

Layers:
1. L1: In-memory (local cache) - microseconds
2. L2: Redis (distributed) - milliseconds
3. L3: Database (with query cache) - tens of milliseconds

Features:
- Automatic cache warming
- Cache stampede prevention
- TTL management
- Cache invalidation patterns
- Multi-level caching

Usage:
    from kernel.performance import cache_result

    @cache_result(ttl=300, key_prefix='product')
    def get_product(product_id):
        return Product.objects.get(id=product_id)
"""

import logging
import hashlib
import pickle
from functools import wraps
from django.core.cache import cache, caches
from django.db.models.signals import post_save, post_delete
from threading import Lock
import time

logger = logging.getLogger(__name__)


class CacheManager:
    """
    Multi-layer cache manager with automatic invalidation.
    """

    # L1: Local in-memory cache (fastest)
    _local_cache = {}
    _local_cache_lock = Lock()
    _local_cache_ttl = {}

    # Cache stampede prevention
    _computing_locks = {}

    @classmethod
    def get(cls, key, default=None, layers=['l1', 'l2']):
        """
        Get value from cache (checks all layers).

        Args:
            key: Cache key
            default: Default value if not found
            layers: Which cache layers to check ['l1', 'l2', 'l3']

        Returns:
            Cached value or default
        """
        # L1: Local cache (microseconds)
        if 'l1' in layers:
            value = cls._get_local(key)
            if value is not None:
                logger.debug(f"Cache L1 HIT: {key}")
                return value

        # L2: Redis (milliseconds)
        if 'l2' in layers:
            value = cache.get(key)
            if value is not None:
                logger.debug(f"Cache L2 HIT: {key}")
                # Warm L1 cache
                if 'l1' in layers:
                    cls._set_local(key, value, ttl=60)
                return value

        logger.debug(f"Cache MISS: {key}")
        return default

    @classmethod
    def set(cls, key, value, ttl=300, layers=['l1', 'l2']):
        """
        Set value in cache (all specified layers).

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            layers: Which layers to update
        """
        # L1: Local cache
        if 'l1' in layers:
            cls._set_local(key, value, ttl=min(ttl, 300))  # L1 max 5min

        # L2: Redis
        if 'l2' in layers:
            cache.set(key, value, ttl)

    @classmethod
    def delete(cls, key, layers=['l1', 'l2']):
        """Delete from all cache layers"""
        if 'l1' in layers:
            cls._delete_local(key)

        if 'l2' in layers:
            cache.delete(key)

    @classmethod
    def delete_pattern(cls, pattern):
        """
        Delete all keys matching pattern.

        Example:
            CacheManager.delete_pattern('product:*')
        """
        # L1
        with cls._local_cache_lock:
            keys_to_delete = [
                k for k in cls._local_cache.keys()
                if pattern.replace('*', '') in k
            ]
            for key in keys_to_delete:
                del cls._local_cache[key]
                if key in cls._local_cache_ttl:
                    del cls._local_cache_ttl[key]

        # L2: Redis - use SCAN for safety
        try:
            redis_cache = caches['default']
            if hasattr(redis_cache, 'delete_pattern'):
                redis_cache.delete_pattern(pattern)
        except Exception as e:
            logger.error(f"Error deleting cache pattern {pattern}: {e}")

    @classmethod
    def _get_local(cls, key):
        """Get from L1 local cache"""
        with cls._local_cache_lock:
            # Check TTL
            if key in cls._local_cache_ttl:
                if time.time() > cls._local_cache_ttl[key]:
                    # Expired
                    del cls._local_cache[key]
                    del cls._local_cache_ttl[key]
                    return None

            return cls._local_cache.get(key)

    @classmethod
    def _set_local(cls, key, value, ttl=60):
        """Set in L1 local cache"""
        with cls._local_cache_lock:
            cls._local_cache[key] = value
            cls._local_cache_ttl[key] = time.time() + ttl

    @classmethod
    def _delete_local(cls, key):
        """Delete from L1 local cache"""
        with cls._local_cache_lock:
            if key in cls._local_cache:
                del cls._local_cache[key]
            if key in cls._local_cache_ttl:
                del cls._local_cache_ttl[key]

    @classmethod
    def get_or_compute(cls, key, compute_func, ttl=300, prevent_stampede=True):
        """
        Get from cache or compute and cache result.

        Includes cache stampede prevention.

        Args:
            key: Cache key
            compute_func: Function to compute value if not cached
            ttl: Cache TTL
            prevent_stampede: If True, only one thread computes at a time

        Returns:
            Cached or computed value
        """
        # Try cache first
        value = cls.get(key)
        if value is not None:
            return value

        # Cache stampede prevention
        if prevent_stampede:
            # Check if someone else is computing
            lock_key = f"lock:{key}"

            if lock_key in cls._computing_locks:
                # Wait for other thread to finish
                lock = cls._computing_locks[lock_key]
                with lock:
                    # Check cache again
                    value = cls.get(key)
                    if value is not None:
                        return value

            # We're computing it
            cls._computing_locks[lock_key] = Lock()
            with cls._computing_locks[lock_key]:
                # Double-check cache
                value = cls.get(key)
                if value is not None:
                    return value

                # Compute
                value = compute_func()

                # Cache result
                cls.set(key, value, ttl)

            # Clean up lock
            del cls._computing_locks[lock_key]

        else:
            # No stampede prevention
            value = compute_func()
            cls.set(key, value, ttl)

        return value


def cache_result(ttl=300, key_prefix='', key_builder=None, invalidate_on=None):
    """
    Decorator to cache function results.

    Args:
        ttl: Cache time-to-live in seconds
        key_prefix: Prefix for cache key
        key_builder: Custom function to build cache key
        invalidate_on: List of models that invalidate this cache

    Usage:
        @cache_result(ttl=300, key_prefix='product')
        def get_product(product_id):
            return Product.objects.get(id=product_id)

        @cache_result(ttl=600, invalidate_on=[Invoice])
        def get_invoice_total(invoice_id):
            return Invoice.objects.get(id=invoice_id).total
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # Default key building
                key_parts = [key_prefix or func.__name__]

                # Add args
                for arg in args:
                    if hasattr(arg, 'id'):
                        key_parts.append(str(arg.id))
                    else:
                        key_parts.append(str(arg)[:50])

                # Add kwargs
                for k, v in sorted(kwargs.items()):
                    if hasattr(v, 'id'):
                        key_parts.append(f"{k}={v.id}")
                    else:
                        key_parts.append(f"{k}={str(v)[:50]}")

                cache_key = ':'.join(key_parts)

            # Get or compute
            return CacheManager.get_or_compute(
                cache_key,
                lambda: func(*args, **kwargs),
                ttl=ttl
            )

        # Set up auto-invalidation
        if invalidate_on:
            for model in invalidate_on:
                _setup_cache_invalidation(model, key_prefix or func.__name__)

        return wrapper

    return decorator


def _setup_cache_invalidation(model, key_prefix):
    """Set up automatic cache invalidation on model save/delete"""
    def invalidate_cache(sender, instance, **kwargs):
        CacheManager.delete_pattern(f"{key_prefix}:*")
        logger.debug(f"Invalidated cache pattern: {key_prefix}:*")

    post_save.connect(invalidate_cache, sender=model, weak=False)
    post_delete.connect(invalidate_cache, sender=model, weak=False)


class CacheWarmer:
    """
    Proactively warm cache with frequently accessed data.
    """

    @classmethod
    def warm_common_data(cls, organization_id):
        """
        Warm cache with commonly accessed data for an organization.

        Call this during off-peak hours or after deployment.
        """
        logger.info(f"Warming cache for organization {organization_id}")

        # Warm chart of accounts
        try:
            from apps.finance.models import ChartOfAccount
            accounts = list(ChartOfAccount.objects.filter(
                organization_id=organization_id
            ).values('id', 'code', 'name', 'account_type'))

            CacheManager.set(
                f"finance:coa:{organization_id}",
                accounts,
                ttl=3600  # 1 hour
            )
            logger.info(f"Warmed {len(accounts)} chart of accounts")
        except Exception as e:
            logger.error(f"Error warming chart of accounts: {e}")

        # Warm product catalog
        try:
            from apps.inventory.models import Product
            products = list(Product.objects.filter(
                organization_id=organization_id,
                is_active=True
            ).values('id', 'name', 'sku', 'price'))

            CacheManager.set(
                f"inventory:products:{organization_id}",
                products,
                ttl=1800  # 30 min
            )
            logger.info(f"Warmed {len(products)} products")
        except Exception as e:
            logger.error(f"Error warming products: {e}")

        # Warm connector capabilities
        try:
            from erp.connector_registry import capability_registry
            capabilities = capability_registry.list_all()

            CacheManager.set(
                "connector:capabilities",
                capabilities,
                ttl=7200  # 2 hours
            )
            logger.info("Warmed connector capabilities")
        except Exception as e:
            logger.error(f"Error warming capabilities: {e}")


# Cache statistics
class CacheStats:
    """Track cache hit/miss rates"""

    @classmethod
    def get_stats(cls):
        """Get cache performance statistics"""
        # Redis stats
        try:
            redis_cache = caches['default']
            if hasattr(redis_cache, '_cache'):
                redis_client = redis_cache._cache.get_client()
                info = redis_client.info('stats')

                return {
                    'redis': {
                        'hits': info.get('keyspace_hits', 0),
                        'misses': info.get('keyspace_misses', 0),
                        'hit_rate': (
                            info.get('keyspace_hits', 0) /
                            (info.get('keyspace_hits', 0) + info.get('keyspace_misses', 1))
                        ),
                        'used_memory': info.get('used_memory_human', 'N/A'),
                    },
                    'local': {
                        'keys': len(CacheManager._local_cache),
                        'size': len(str(CacheManager._local_cache))
                    }
                }
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {'error': str(e)}
