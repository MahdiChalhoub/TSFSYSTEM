"""
Observability Integration — ConnectorEngine Instrumentation
============================================================
Wires the kernel observability engine (metrics + sentry) into the
ConnectorEngine and Event Bus for production monitoring.

Usage:
    # In core/apps.py ready():
    from apps.core.observability import setup_observability
    setup_observability()

    # In any module:
    from apps.core.observability import track_operation, capture_error

    with track_operation('finance.post_journal', org_id=org.id):
        LedgerService.create_journal_entry(...)
"""

import time
import logging
from contextlib import contextmanager
from functools import wraps

logger = logging.getLogger(__name__)


def setup_observability():
    """
    Initialize observability stack at startup.
    Reads config from environment / get_config.
    """
    import os

    # ── Sentry (error tracking + performance) ──
    sentry_dsn = os.environ.get('SENTRY_DSN', '')
    if sentry_dsn:
        try:
            from kernel.observability.sentry_integration import initialize_sentry
            environment = os.environ.get('ENVIRONMENT', 'production')
            initialize_sentry(
                dsn=sentry_dsn,
                environment=environment,
                traces_sample_rate=float(os.environ.get('SENTRY_TRACES_RATE', '0.1')),
                profiles_sample_rate=float(os.environ.get('SENTRY_PROFILES_RATE', '0.1')),
            )
            logger.info(f"✅ Sentry initialized: {environment}")
        except Exception as e:
            logger.warning(f"⚠️ Sentry initialization failed: {e}")

    # ── Metrics (StatsD/Prometheus) ──
    statsd_host = os.environ.get('STATSD_HOST', '')
    if statsd_host:
        try:
            from kernel.observability.metrics import initialize_metrics
            initialize_metrics(
                backend='statsd',
                host=statsd_host,
                port=int(os.environ.get('STATSD_PORT', '8125')),
                prefix='tsfsystem',
            )
            logger.info(f"✅ StatsD metrics initialized: {statsd_host}")
        except Exception as e:
            logger.warning(f"⚠️ StatsD initialization failed: {e}")

    logger.info("✅ Observability stack ready (events will be logged)")


@contextmanager
def track_operation(operation_name, org_id=None, **extra_tags):
    """
    Context manager that tracks an operation's duration and success/failure.

    Usage:
        with track_operation('finance.post_journal', org_id=org.id):
            LedgerService.create_journal_entry(...)
    """
    from kernel.observability.metrics import record_timing, increment_counter

    tags = {'operation': operation_name}
    if org_id:
        tags['org_id'] = str(org_id)
    tags.update(extra_tags)

    start = time.time()
    try:
        yield
        increment_counter(f'operation.{operation_name}.success', tags=tags)
    except Exception as e:
        increment_counter(f'operation.{operation_name}.error', tags=tags)
        capture_error(e, context={'operation': operation_name, 'org_id': org_id})
        raise
    finally:
        duration_ms = (time.time() - start) * 1000
        record_timing(f'operation.{operation_name}.duration', duration_ms, tags=tags)


def capture_error(exception, context=None, tags=None):
    """
    Capture an error — routes to Sentry if available, always logs locally.

    Usage:
        try:
            do_something()
        except Exception as e:
            capture_error(e, context={'invoice_id': inv.id}, tags={'module': 'finance'})
    """
    try:
        from kernel.observability.sentry_integration import capture_exception
        capture_exception(exception, context=context, tags=tags)
    except Exception:
        # Sentry not available — log locally
        logger.error(f"Error captured: {exception}", exc_info=True, extra={
            'context': context, 'tags': tags
        })


def track_connector_route(func):
    """
    Decorator for ConnectorEngine.route_read / route_write.
    Automatically tracks routing latency, success rate, and errors.
    """
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        from kernel.observability.metrics import record_timing, increment_counter

        # Extract target module from kwargs or args
        target = kwargs.get('target_module', '')
        source = kwargs.get('source_module', '')
        endpoint = kwargs.get('endpoint', '')
        op_name = f"connector.{source}_to_{target}"

        start = time.time()
        try:
            result = func(self, *args, **kwargs)
            increment_counter(f'{op_name}.success')
            return result
        except Exception as e:
            increment_counter(f'{op_name}.error')
            capture_error(e, context={
                'source': source, 'target': target, 'endpoint': endpoint
            })
            raise
        finally:
            duration_ms = (time.time() - start) * 1000
            record_timing(f'{op_name}.duration', duration_ms)

    return wrapper


def track_event_processing(func):
    """
    Decorator for EventBus.process_event.
    Tracks event processing latency and failure rates.
    """
    @wraps(func)
    def wrapper(cls, event, *args, **kwargs):
        from kernel.observability.metrics import record_timing, increment_counter

        event_type = getattr(event, 'event_type', 'unknown')
        start = time.time()
        try:
            result = func(cls, event, *args, **kwargs)
            increment_counter(f'event.{event_type}.processed')
            return result
        except Exception as e:
            increment_counter(f'event.{event_type}.failed')
            capture_error(e, context={
                'event_type': event_type,
                'event_id': str(getattr(event, 'event_id', '')),
            })
            raise
        finally:
            duration_ms = (time.time() - start) * 1000
            record_timing(f'event.{event_type}.duration', duration_ms)

    return wrapper
