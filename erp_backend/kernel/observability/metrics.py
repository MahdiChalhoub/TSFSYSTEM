"""
Metrics Collection

Collect and send metrics to StatsD, Prometheus, or other backends.
"""

import logging
import time
from typing import Dict, Optional
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Try to import metrics backends
try:
    from statsd import StatsClient
    STATSD_AVAILABLE = True
except ImportError:
    STATSD_AVAILABLE = False

# Global metrics client
_metrics_client = None


def initialize_metrics(backend: str = 'statsd', **kwargs):
    """
    Initialize metrics client.

    Args:
        backend: Metrics backend ('statsd', 'prometheus', 'datadog')
        **kwargs: Backend-specific options

    Example:
        # In settings.py or AppConfig.ready()
        from kernel.observability import initialize_metrics
        initialize_metrics(
            backend='statsd',
            host='localhost',
            port=8125,
            prefix='tsfsystem'
        )
    """
    global _metrics_client

    if backend == 'statsd' and STATSD_AVAILABLE:
        _metrics_client = StatsClient(
            host=kwargs.get('host', 'localhost'),
            port=kwargs.get('port', 8125),
            prefix=kwargs.get('prefix', 'tsfsystem')
        )
        logger.info(f"StatsD metrics initialized: {kwargs.get('host')}:{kwargs.get('port')}")
    else:
        logger.warning(f"Metrics backend '{backend}' not available")


def record_metric(
    name: str,
    value: float,
    tags: Optional[Dict[str, str]] = None,
    metric_type: str = 'gauge'
):
    """
    Record a metric.

    Args:
        name: Metric name (e.g., 'invoice.total', 'api.response_time')
        value: Metric value
        tags: Tags for filtering (e.g., {'currency': 'USD', 'module': 'finance'})
        metric_type: Type of metric ('gauge', 'counter', 'histogram')

    Example:
        record_metric('invoice.total', invoice.total, tags={'currency': 'USD'})
    """
    if _metrics_client is None:
        # Log to console if no metrics backend
        logger.debug(f"Metric: {name} = {value} (tags: {tags})")
        return

    # Format metric name with tags
    if tags:
        tag_str = ','.join(f"{k}={v}" for k, v in tags.items())
        metric_name = f"{name}:{tag_str}"
    else:
        metric_name = name

    try:
        if metric_type == 'gauge':
            _metrics_client.gauge(metric_name, value)
        elif metric_type == 'counter':
            _metrics_client.incr(metric_name, value)
        elif metric_type == 'histogram':
            _metrics_client.timing(metric_name, value)
    except Exception as e:
        logger.error(f"Failed to record metric: {str(e)}")


def increment_counter(
    name: str,
    count: int = 1,
    tags: Optional[Dict[str, str]] = None
):
    """
    Increment a counter.

    Args:
        name: Counter name (e.g., 'invoice.created', 'api.requests')
        count: Increment amount
        tags: Tags for filtering

    Example:
        increment_counter('invoice.created', tags={'module': 'finance'})
    """
    record_metric(name, count, tags, metric_type='counter')


def record_timing(
    name: str,
    duration_ms: float,
    tags: Optional[Dict[str, str]] = None
):
    """
    Record timing/duration.

    Args:
        name: Timer name (e.g., 'invoice.processing_time')
        duration_ms: Duration in milliseconds
        tags: Tags for filtering

    Example:
        start = time.time()
        process_invoice(invoice_id)
        duration = (time.time() - start) * 1000
        record_timing('invoice.processing_time', duration)
    """
    record_metric(name, duration_ms, tags, metric_type='histogram')


@contextmanager
def timed(name: str, tags: Optional[Dict[str, str]] = None):
    """
    Context manager for timing code blocks.

    Args:
        name: Timer name
        tags: Tags for filtering

    Example:
        with timed('invoice.processing_time', tags={'module': 'finance'}):
            process_invoice(invoice_id)
    """
    start = time.time()
    try:
        yield
    finally:
        duration_ms = (time.time() - start) * 1000
        record_timing(name, duration_ms, tags)


# Module-level helper functions

def track_event(event_name: str, properties: Optional[Dict[str, Any]] = None):
    """
    Track business event (for analytics).

    Args:
        event_name: Event name (e.g., 'invoice_created', 'payment_received')
        properties: Event properties

    Example:
        track_event('invoice_created', {
            'invoice_id': invoice.id,
            'total': float(invoice.total),
            'currency': 'USD'
        })
    """
    # Increment counter
    increment_counter(f"events.{event_name}")

    # Log event
    logger.info(f"Event: {event_name}", extra={'properties': properties})

    # Could send to analytics platform (Mixpanel, Amplitude, etc.)
    # For now, just increment counter


def track_user_action(user_id: int, action: str, properties: Optional[Dict[str, Any]] = None):
    """
    Track user action (for user analytics).

    Args:
        user_id: User ID
        action: Action name
        properties: Additional properties

    Example:
        track_user_action(
            request.user.id,
            'invoice_created',
            {'invoice_id': invoice.id}
        )
    """
    track_event(action, {
        'user_id': user_id,
        **(properties or {})
    })
