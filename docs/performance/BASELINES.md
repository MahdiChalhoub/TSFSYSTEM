# Performance Baselines

**Date Established**: 2026-03-14
**Version**: 3.1.0
**Environment**: Production

## Executive Summary

This document establishes performance baselines for TSFSYSTEM to:
- Monitor performance over time
- Detect regressions early
- Set SLOs (Service Level Objectives)
- Guide optimization efforts

## Frontend Performance

### Lighthouse Scores (Target)

| Page | Performance | Accessibility | Best Practices | SEO | Target |
|------|------------|---------------|----------------|-----|--------|
| Dashboard | TBD | TBD | TBD | TBD | 90+ |
| POS Terminal | TBD | TBD | TBD | TBD | 85+ |
| Inventory List | TBD | TBD | TBD | TBD | 90+ |
| Finance Reports | TBD | TBD | TBD | TBD | 85+ |
| CRM Contacts | TBD | TBD | TBD | TBD | 90+ |

### Core Web Vitals

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **LCP** (Largest Contentful Paint) | < 2.5s | TBD | ⏳ |
| **FID** (First Input Delay) | < 100ms | TBD | ⏳ |
| **CLS** (Cumulative Layout Shift) | < 0.1 | TBD | ⏳ |

### Page Load Times (p95)

| Page | Target | Current | Notes |
|------|--------|---------|-------|
| Dashboard | < 2s | TBD | Server component heavy |
| POS Terminal | < 1.5s | TBD | Critical for retail |
| Product Catalog | < 2s | TBD | Image optimization critical |
| Invoice Create | < 2s | TBD | Form rendering |

### Bundle Sizes

| Bundle | Target | Current | Compression |
|--------|--------|---------|-------------|
| Main JS | < 300KB | TBD | Gzip |
| Vendor JS | < 500KB | TBD | Gzip |
| CSS | < 50KB | TBD | Gzip |
| Total First Load | < 850KB | TBD | Gzip |

## Backend Performance

### API Response Times (p95)

| Endpoint | Target | Current | Notes |
|----------|--------|---------|-------|
| `GET /api/inventory/products/` | < 200ms | TBD | Paginated list |
| `POST /api/pos/orders/` | < 500ms | TBD | Create order + inventory update |
| `GET /api/finance/reports/balance-sheet/` | < 2s | TBD | Complex aggregation |
| `POST /api/finance/journal-entries/` | < 300ms | TBD | Double-entry validation |
| `GET /api/crm/contacts/?search=xyz` | < 300ms | TBD | Full-text search |
| `POST /api/inventory/movements/` | < 400ms | TBD | Stock update + validation |

### Database Query Performance

| Query Type | Target | Current | Notes |
|------------|--------|---------|-------|
| Simple SELECT | < 10ms | TBD | Single table, indexed |
| JOIN (2-3 tables) | < 50ms | TBD | With select_related |
| Aggregations | < 200ms | TBD | COUNT, SUM, GROUP BY |
| Reports | < 2s | TBD | Complex multi-table joins |

### N+1 Query Detection

| Module | Status | Notes |
|--------|--------|-------|
| Inventory | ✅ | select_related('warehouse', 'product') |
| Finance | ⚠️ | Some invoice serializers missing prefetch |
| CRM | ✅ | Optimized with prefetch_related |
| POS | ✅ | All querysets optimized |

## Service Level Objectives (SLOs)

### Availability
- **Target**: 99.9% uptime (8.76 hours downtime/year)
- **Measurement**: Monthly uptime percentage
- **Monitoring**: Uptime Robot, StatusCake

### API Performance
- **Target**: 95% of requests < 500ms
- **Target**: 99% of requests < 2s
- **Measurement**: p95 and p99 response times
- **Monitoring**: Application Performance Monitoring (APM)

### Error Rates
- **Target**: < 0.1% error rate (4xx + 5xx)
- **Measurement**: Errors per 1000 requests
- **Monitoring**: Error tracking (Sentry, LogRocket)

### Database Performance
- **Target**: < 100ms average query time
- **Target**: No queries > 5s
- **Measurement**: Django Debug Toolbar, pg_stat_statements
- **Monitoring**: Database monitoring tools

## Performance Budget

### Frontend Budget
- **JavaScript Bundle**: Max 300KB (gzipped)
- **Images per page**: Max 10 (lazy-loaded below fold)
- **External Requests**: Max 5 (fonts, analytics, etc.)
- **Time to Interactive**: < 3s

### Backend Budget
- **API Response Time**: Max 500ms (95th percentile)
- **Database Queries per Request**: Max 20
- **N+1 Queries**: Zero tolerance
- **Memory per Request**: < 100MB

## Monitoring Tools

### Recommended Tools

**Frontend**:
- Lighthouse CI (automated audits)
- WebPageTest (detailed metrics)
- Chrome DevTools Performance tab
- React DevTools Profiler

**Backend**:
- Django Debug Toolbar (development)
- Django Silk (profiling)
- New Relic / DataDog (APM)
- PostgreSQL pg_stat_statements

**Full Stack**:
- Sentry (error tracking)
- LogRocket (session replay)
- Google Analytics (user behavior)

## How to Measure

### Frontend Lighthouse Audit
```bash
# Install Lighthouse
npm install -g lighthouse

# Run audit (example: dashboard)
lighthouse http://localhost:3000/dashboard \
  --output=html \
  --output-path=docs/performance/lighthouse-dashboard-$(date +%Y%m%d).html

# Run for multiple pages
bash scripts/lighthouse-audit.sh
```

### Backend API Benchmarking
```python
# Using Django's test client
import time
from django.test import Client

client = Client()
start = time.time()
response = client.get('/api/inventory/products/')
duration = time.time() - start
print(f"Response time: {duration*1000:.2f}ms")
```

### Database Query Analysis
```python
# Enable query logging in Django settings (development only)
LOGGING = {
    'loggers': {
        'django.db.backends': {
            'level': 'DEBUG',
        },
    },
}

# Or use Django Debug Toolbar
# Shows queries, execution time, EXPLAIN plans
```

## Optimization Checklist

### When Performance Degrades

**Frontend**:
- [ ] Run Lighthouse audit to identify regressions
- [ ] Check bundle size (did it increase significantly?)
- [ ] Profile component renders (React DevTools)
- [ ] Analyze network waterfall (Chrome DevTools)
- [ ] Check for render-blocking resources

**Backend**:
- [ ] Enable Django Debug Toolbar
- [ ] Look for N+1 queries
- [ ] Check for missing database indexes
- [ ] Profile slow endpoints (Django Silk)
- [ ] Review database query plans (EXPLAIN)

**Database**:
- [ ] Analyze slow query log
- [ ] Check for missing indexes
- [ ] Review table statistics (VACUUM, ANALYZE)
- [ ] Monitor connection pool usage
- [ ] Check for lock contention

## Next Steps

1. **Establish Baselines** (Week 1):
   - Run Lighthouse on all key pages
   - Benchmark top 20 API endpoints
   - Document current performance

2. **Set Up Monitoring** (Week 2):
   - Configure APM tool (New Relic/DataDog)
   - Set up error tracking (Sentry)
   - Create performance dashboard

3. **Continuous Monitoring** (Ongoing):
   - Weekly Lighthouse runs
   - Daily performance dashboard review
   - Alert on regressions > 20%

4. **Quarterly Reviews** (Every 3 months):
   - Review and update baselines
   - Identify optimization opportunities
   - Plan performance sprints

---

**Next Measurement Date**: 2026-04-14
**Performance Owner**: Engineering Team
**Review Frequency**: Monthly
