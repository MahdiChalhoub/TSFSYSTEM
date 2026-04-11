"""
Performance Optimization Package
=================================
Tools and utilities for optimizing TSFSYSTEM performance.

Modules:
- query_optimizer: Database query optimization
- cache_strategies: Advanced caching patterns
- profiling: Performance profiling tools
- benchmarks: Performance benchmarks
"""

from .query_optimizer import QueryOptimizer, optimize_queryset
from .cache_strategies import CacheManager, cache_result
from .profiling import profile_view, profile_function

__all__ = [
    'QueryOptimizer',
    'optimize_queryset',
    'CacheManager',
    'cache_result',
    'profile_view',
    'profile_function',
]
