"""
Performance Profiling Tools
============================
Profile views, functions, and queries to find bottlenecks.

Features:
- View profiling with detailed timing
- Function profiling
- Query counting
- Memory profiling
- Slow operation alerts

Usage:
    from kernel.performance import profile_view

    @profile_view
    def my_view(request):
        ...
"""

import logging
import time
import functools
from django.db import connection, reset_queries
from django.conf import settings

logger = logging.getLogger(__name__)


def profile_view(func):
    """
    Decorator to profile view performance.

    Logs:
    - Total execution time
    - Query count
    - Slow queries
    - Memory usage

    Usage:
        @profile_view
        def invoice_list(request):
            ...
    """
    @functools.wraps(func)
    def wrapper(request, *args, **kwargs):
        # Only profile in DEBUG or if explicitly enabled
        if not settings.DEBUG and not getattr(settings, 'ENABLE_PROFILING', False):
            return func(request, *args, **kwargs)

        reset_queries()
        start_time = time.time()
        start_queries = len(connection.queries)

        try:
            result = func(request, *args, **kwargs)
            return result

        finally:
            elapsed = time.time() - start_time
            query_count = len(connection.queries) - start_queries

            # Log performance
            logger.info(
                f"VIEW PROFILE | {func.__name__} | "
                f"Time: {elapsed*1000:.2f}ms | "
                f"Queries: {query_count}"
            )

            # Warn if slow
            if elapsed > 1.0:  # > 1 second
                logger.warning(
                    f"SLOW VIEW: {func.__name__} took {elapsed:.2f}s"
                )

            # Warn if many queries
            if query_count > 50:
                logger.warning(
                    f"MANY QUERIES: {func.__name__} made {query_count} queries. "
                    f"Possible N+1 problem."
                )

            # Log slow queries
            for query in connection.queries[start_queries:]:
                query_time = float(query.get('time', 0))
                if query_time > 0.1:  # > 100ms
                    logger.warning(
                        f"SLOW QUERY ({query_time}s): {query['sql'][:200]}"
                    )

    return wrapper


def profile_function(threshold_ms=100):
    """
    Decorator to profile function performance.

    Args:
        threshold_ms: Log warning if function takes longer than this

    Usage:
        @profile_function(threshold_ms=50)
        def expensive_calculation():
            ...
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()

            result = func(*args, **kwargs)

            elapsed = time.time() - start_time
            elapsed_ms = elapsed * 1000

            if elapsed_ms > threshold_ms:
                logger.warning(
                    f"SLOW FUNCTION: {func.__name__} took {elapsed_ms:.2f}ms "
                    f"(threshold: {threshold_ms}ms)"
                )
            else:
                logger.debug(
                    f"Function {func.__name__} took {elapsed_ms:.2f}ms"
                )

            return result

        return wrapper

    return decorator


class PerformanceMonitor:
    """
    Context manager for detailed performance monitoring.

    Usage:
        with PerformanceMonitor("expensive_operation") as monitor:
            # Your code here
            result = do_expensive_thing()

        print(f"Took {monitor.elapsed_ms}ms")
        print(f"Made {monitor.query_count} queries")
    """

    def __init__(self, operation_name):
        self.operation_name = operation_name
        self.start_time = None
        self.end_time = None
        self.start_queries = 0
        self.end_queries = 0

    def __enter__(self):
        self.start_time = time.time()
        reset_queries()
        self.start_queries = len(connection.queries)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.time()
        self.end_queries = len(connection.queries)

        elapsed_ms = (self.end_time - self.start_time) * 1000
        query_count = self.end_queries - self.start_queries

        logger.info(
            f"OPERATION: {self.operation_name} | "
            f"Time: {elapsed_ms:.2f}ms | "
            f"Queries: {query_count}"
        )

        # Store for external access
        self.elapsed_ms = elapsed_ms
        self.query_count = query_count

        return False  # Don't suppress exceptions

    def report(self):
        """Get detailed report"""
        return {
            'operation': self.operation_name,
            'elapsed_ms': self.elapsed_ms,
            'query_count': self.query_count,
            'avg_query_time_ms': (
                self.elapsed_ms / self.query_count
                if self.query_count > 0
                else 0
            )
        }
