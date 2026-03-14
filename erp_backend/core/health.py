"""
TSFSYSTEM Health Check Endpoints

Provides /health/, /health/db/, and /health/full/ endpoints
for monitoring, load balancer checks, and incident response.
"""
import time
import logging
from django.http import JsonResponse
from django.db import connection
from django.conf import settings

logger = logging.getLogger('tsfsystem.health')


def health_check(request):
    """Basic health check — confirms the application is running."""
    return JsonResponse({
        'status': 'healthy',
        'service': 'tsfsystem',
        'timestamp': time.time(),
    })


def health_db(request):
    """Database connectivity check."""
    try:
        start = time.monotonic()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        latency_ms = round((time.monotonic() - start) * 1000, 2)

        return JsonResponse({
            'status': 'healthy',
            'database': {
                'status': 'connected',
                'latency_ms': latency_ms,
                'engine': settings.DATABASES['default']['ENGINE'],
            },
            'timestamp': time.time(),
        })
    except Exception as e:
        logger.error(f"Health check DB failed: {e}")
        return JsonResponse({
            'status': 'unhealthy',
            'database': {
                'status': 'disconnected',
                'error': str(e),
            },
            'timestamp': time.time(),
        }, status=503)


def health_full(request):
    """Full system health — DB + cache + critical services."""
    checks = {}
    overall_healthy = True

    # Database
    try:
        start = time.monotonic()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_latency = round((time.monotonic() - start) * 1000, 2)
        checks['database'] = {'status': 'ok', 'latency_ms': db_latency}
    except Exception as e:
        checks['database'] = {'status': 'error', 'error': str(e)}
        overall_healthy = False

    # Cache (Redis)
    try:
        from django.core.cache import cache
        start = time.monotonic()
        cache.set('_health_check', '1', timeout=5)
        val = cache.get('_health_check')
        cache_latency = round((time.monotonic() - start) * 1000, 2)
        if val == '1':
            checks['cache'] = {'status': 'ok', 'latency_ms': cache_latency}
        else:
            checks['cache'] = {'status': 'degraded', 'detail': 'write ok, read mismatch'}
    except Exception as e:
        checks['cache'] = {'status': 'unavailable', 'detail': str(e)}
        # Cache failure is degraded, not unhealthy
    
    # Migrations
    try:
        from django.core.management import call_command
        from io import StringIO
        out = StringIO()
        call_command('showmigrations', '--plan', stdout=out)
        output = out.getvalue()
        unapplied = [l for l in output.strip().split('\n') if l.strip().startswith('[ ]')]
        if unapplied:
            checks['migrations'] = {'status': 'pending', 'unapplied_count': len(unapplied)}
        else:
            checks['migrations'] = {'status': 'ok'}
    except Exception:
        checks['migrations'] = {'status': 'unknown'}

    # Version info
    import json
    version = 'unknown'
    try:
        import os
        pkg_path = os.path.join(settings.BASE_DIR, '..', 'package.json')
        if os.path.exists(pkg_path):
            with open(pkg_path) as f:
                version = json.load(f).get('version', 'unknown')
    except Exception:
        pass

    status_code = 200 if overall_healthy else 503
    return JsonResponse({
        'status': 'healthy' if overall_healthy else 'unhealthy',
        'service': 'tsfsystem',
        'version': version,
        'checks': checks,
        'timestamp': time.time(),
    }, status=status_code)


def error_report(request):
    """Receive frontend error reports (fire-and-forget from client)."""
    if request.method != 'POST':
        return JsonResponse({'error': 'method_not_allowed'}, status=405)

    try:
        import json
        data = json.loads(request.body)
        logger.warning(
            'Frontend error: %(message)s [%(source)s] %(url)s digest=%(digest)s',
            {
                'message': data.get('message', 'unknown'),
                'source': data.get('source', 'unknown'),
                'url': data.get('url', ''),
                'digest': data.get('digest', ''),
            }
        )
    except Exception:
        pass  # Never fail on malformed reports

    return JsonResponse({'status': 'received'}, status=204)
