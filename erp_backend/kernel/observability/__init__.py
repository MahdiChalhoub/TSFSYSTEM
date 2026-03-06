"""
Observability

Provides hooks for logging, metrics, and traces.

Integrates with:
- Sentry (error tracking)
- Prometheus/StatsD (metrics)
- OpenTelemetry (traces)

Usage:
    from kernel.observability import track_event, capture_exception, record_metric

    # Track event
    track_event('invoice.created', {'invoice_id': 123})

    # Capture exception
    try:
        ...
    except Exception as e:
        capture_exception(e, {'context': 'invoice creation'})

    # Record metric
    record_metric('invoice.total', 150.00, tags={'currency': 'USD'})
"""

from .sentry_integration import capture_exception, capture_message, set_context
from .metrics import record_metric, increment_counter, record_timing
from .middleware import ObservabilityMiddleware
from .decorators import track_performance, track_errors

__all__ = [
    'capture_exception',
    'capture_message',
    'set_context',
    'record_metric',
    'increment_counter',
    'record_timing',
    'ObservabilityMiddleware',
    'track_performance',
    'track_errors',
]
