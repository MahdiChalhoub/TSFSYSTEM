# API Latency Monitoring & AES Encryption Add-on

## Goal
Add real-time API response time monitoring with P50/P95/P99 percentile metrics, and offer AES-256 Encryption as a paid SaaS add-on service.

## Data Flow
```
Request → LatencyTrackingMiddleware → records (path, method, status, ms) → LatencyStore ring buffer (1000 entries)
                                                                             ↓
                                                            GET /api/health/ → reads stats → returns P50/P95/P99 JSON
                                                                             ↓
                                                   Frontend health/page.tsx → auto-refresh 30s → displays live dashboard
```

## Files

### Backend
| File | Purpose |
|------|---------|
| `erp/latency_middleware.py` | Middleware + singleton LatencyStore with thread-safe ring buffer |
| `core/settings.py` | Middleware registered as first in chain |
| `erp/views.py` | `health_check` now returns real latency/traffic/slow_endpoints data |
| `erp/models.py` | `PlanAddon.ADDON_TYPES` now includes `('encryption', 'AES-256 Encryption')` |

### Frontend
| File | Purpose |
|------|---------|
| `health/page.tsx` | Live dashboard with P50/P95 badges, response code breakdown, slow endpoint ranking |

## Variables
- **Ring buffer size**: 1000 (hardcoded in `LatencyStore.__init__`)
- **Auto-refresh interval**: 30 seconds (frontend)
- **Excluded paths**: `/static/`, `/media/`, `/favicon.ico`, `/api/health/`, `/__nextjs`

## Where Data is READ
- `GET /api/health/` reads from in-memory `LatencyStore` singleton
- Frontend `health/page.tsx` calls `erpFetch('health/')` every 30s

## Where Data is SAVED
- `LatencyStore._buffer` — in-memory deque, resets on Django restart
- No database writes (zero overhead design)

## AES Encryption Add-on
- Added as `('encryption', 'AES-256 Encryption')` choice in `PlanAddon.ADDON_TYPES`
- No migration needed — `addon_type` is a `CharField` with choices (Django validates at form level only)
- Organizations can subscribe to it as a monthly paid add-on via the existing SaaS subscription management
