"""
API Latency Tracking Middleware
================================
Records response time for every API request in a thread-safe in-memory ring buffer.
Exposes P50/P95/P99 percentile metrics via the health endpoint.

- Zero database overhead (in-memory only)
- Ring buffer holds the last N requests (default: 1000)
- Resets on Django restart (intentional for monitoring)
"""

import time
import threading
import statistics
from collections import deque
from datetime import datetime, timezone


class LatencyStore:
    """Thread-safe in-memory ring buffer for request latency data."""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self, max_size=1000):
        if self._initialized:
            return
        self._buffer = deque(maxlen=max_size)
        self._data_lock = threading.Lock()
        self._total_requests = 0
        self._start_time = datetime.now(timezone.utc)
        self._initialized = True

    def record(self, path, method, status_code, duration_ms):
        """Record a request's latency."""
        with self._data_lock:
            self._buffer.append({
                'path': path,
                'method': method,
                'status': status_code,
                'ms': round(duration_ms, 2),
                'ts': datetime.now(timezone.utc).isoformat(),
            })
            self._total_requests += 1

    def get_stats(self):
        """Calculate P50/P95/P99 and per-endpoint stats."""
        with self._data_lock:
            entries = list(self._buffer)

        if not entries:
            return {
                'total_requests': self._total_requests,
                'tracked_window': 0,
                'avg_ms': 0,
                'p50_ms': 0,
                'p95_ms': 0,
                'p99_ms': 0,
                'max_ms': 0,
                'uptime_seconds': (datetime.now(timezone.utc) - self._start_time).total_seconds(),
                'slow_endpoints': [],
                'status_breakdown': {},
            }

        durations = [e['ms'] for e in entries]
        durations_sorted = sorted(durations)
        n = len(durations_sorted)

        # Recent requests (last 5 minutes)
        now = datetime.now(timezone.utc)
        recent_cutoff = now.timestamp() - 300  # 5 minutes
        recent_count = sum(
            1 for e in entries
            if datetime.fromisoformat(e['ts']).timestamp() > recent_cutoff
        )

        # Per-endpoint P95
        endpoint_stats = {}
        for e in entries:
            key = f"{e['method']} {e['path']}"
            if key not in endpoint_stats:
                endpoint_stats[key] = []
            endpoint_stats[key].append(e['ms'])

        slow_endpoints = []
        for ep, times in endpoint_stats.items():
            times_sorted = sorted(times)
            ep_n = len(times_sorted)
            p95_idx = int(ep_n * 0.95)
            slow_endpoints.append({
                'endpoint': ep,
                'p95_ms': round(times_sorted[min(p95_idx, ep_n - 1)], 2),
                'avg_ms': round(statistics.mean(times), 2),
                'count': ep_n,
            })
        slow_endpoints.sort(key=lambda x: x['p95_ms'], reverse=True)

        # Status code breakdown
        status_breakdown = {}
        for e in entries:
            code = str(e['status'])
            bucket = code[0] + 'xx'
            status_breakdown[bucket] = status_breakdown.get(bucket, 0) + 1

        return {
            'total_requests': self._total_requests,
            'tracked_window': n,
            'requests_last_5min': recent_count,
            'avg_ms': round(statistics.mean(durations), 2),
            'p50_ms': round(durations_sorted[int(n * 0.50)], 2),
            'p95_ms': round(durations_sorted[int(n * 0.95)], 2),
            'p99_ms': round(durations_sorted[min(int(n * 0.99), n - 1)], 2),
            'max_ms': round(max(durations), 2),
            'min_ms': round(min(durations), 2),
            'uptime_seconds': round((datetime.now(timezone.utc) - self._start_time).total_seconds()),
            'slow_endpoints': slow_endpoints[:5],
            'status_breakdown': status_breakdown,
        }


# Paths to exclude from tracking
EXCLUDED_PREFIXES = (
    '/static/',
    '/media/',
    '/favicon.ico',
    '/api/health/',
    '/__nextjs',
)


class LatencyTrackingMiddleware:
    """Django middleware that records response time for every API request."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.store = LatencyStore()

    def __call__(self, request):
        path = request.path

        # Skip excluded paths
        if any(path.startswith(p) for p in EXCLUDED_PREFIXES):
            return self.get_response(request)

        start = time.perf_counter()
        response = self.get_response(request)
        duration_ms = (time.perf_counter() - start) * 1000

        self.store.record(
            path=path,
            method=request.method,
            status_code=response.status_code,
            duration_ms=duration_ms,
        )

        # Add timing header to every response (useful for debugging)
        response['X-Response-Time'] = f'{duration_ms:.2f}ms'

        return response
