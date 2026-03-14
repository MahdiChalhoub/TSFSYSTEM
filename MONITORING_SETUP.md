# 🔍 TSF ERP System - Monitoring & Logging Setup

**Environment**: Production & Staging
**Date**: 2026-03-07
**Purpose**: Comprehensive monitoring, logging, and observability configuration

---

## 📊 Overview

This guide covers setting up monitoring and logging for the TSF ERP system across:
- **Application Performance Monitoring (APM)**
- **Error Tracking & Alerting**
- **Log Aggregation & Analysis**
- **Infrastructure Monitoring**
- **User Analytics**
- **Security Monitoring**

---

## 🎯 Monitoring Stack Options

### Option 1: Full Open Source Stack
- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **Loki** - Log aggregation
- **Jaeger** - Distributed tracing
- **AlertManager** - Alerting

### Option 2: SaaS Solutions (Recommended)
- **Sentry** - Error tracking
- **DataDog** - Full-stack monitoring
- **LogRocket** - Session replay
- **New Relic** - APM

### Option 3: Hybrid Approach (Best of Both)
- **Sentry** (SaaS) - Frontend & backend errors
- **Prometheus + Grafana** (Self-hosted) - Metrics
- **Loki** (Self-hosted) - Logs
- **CloudWatch/Stackdriver** (Cloud native) - Infrastructure

---

## 🚨 Error Tracking Setup (Sentry)

### 1. Create Sentry Account
```bash
# Sign up at https://sentry.io
# Create organization and two projects:
# 1. tsf-frontend (Next.js)
# 2. tsf-backend (Django)
```

### 2. Install Sentry SDK

**Frontend**:
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**Backend**:
```bash
cd erp_backend
pip install sentry-sdk[django]
```

### 3. Configure Sentry - Frontend

Create `sentry.client.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of errors

  // Environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  // Error filtering
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Random plugins/extensions
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    // Network errors
    'NetworkError',
    'Failed to fetch',
  ],

  // User context
  beforeSend(event, hint) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }

    // Filter sensitive data
    if (event.request) {
      delete event.request.cookies;
    }

    return event;
  },
});
```

Create `sentry.server.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,

  // Server-specific config
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
});
```

Create `sentry.edge.config.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

### 4. Configure Sentry - Backend

Edit `erp_backend/core/settings.py`:
```python
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

# Sentry Configuration
if not DEBUG:
    sentry_sdk.init(
        dsn=os.environ.get('SENTRY_DSN'),
        integrations=[
            DjangoIntegration(),
            RedisIntegration(),
            CeleryIntegration(),
        ],

        # Performance Monitoring
        traces_sample_rate=0.1,

        # Profiling
        profiles_sample_rate=0.1,

        # Environment
        environment=os.environ.get('ENVIRONMENT', 'production'),

        # Release tracking
        release=os.environ.get('APP_VERSION', 'unknown'),

        # Error filtering
        ignore_errors=[
            'DisallowedHost',
            'PermissionDenied',
        ],

        # User context
        send_default_pii=False,  # Don't send PII by default

        # Before send callback
        before_send=filter_sensitive_data,
    )

def filter_sensitive_data(event, hint):
    """Filter sensitive data from Sentry events"""
    # Remove sensitive headers
    if 'request' in event and 'headers' in event['request']:
        sensitive_headers = ['Authorization', 'Cookie', 'X-CSRF-Token']
        for header in sensitive_headers:
            if header in event['request']['headers']:
                event['request']['headers'][header] = '[Filtered]'

    # Remove sensitive environment variables
    if 'environment' in event:
        sensitive_vars = ['SECRET_KEY', 'DATABASE_PASSWORD', 'JWT_SECRET']
        for var in sensitive_vars:
            if var in event.get('extra', {}):
                event['extra'][var] = '[Filtered]'

    return event
```

### 5. Environment Variables

Add to `.env.production`:
```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
SENTRY_DSN=https://your-backend-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your_auth_token_here
NEXT_PUBLIC_APP_VERSION=v3.1.4
APP_VERSION=v3.1.4
ENVIRONMENT=production

# Source Maps (for better error tracking)
SENTRY_UPLOAD_SOURCE_MAPS=true
```

### 6. Test Sentry Integration

**Frontend Test**:
Create test page at `src/app/api/sentry-test/route.ts`:
```typescript
export function GET() {
  throw new Error("Sentry Frontend Test Error");
}
```

**Backend Test**:
```python
# In Django shell
from sentry_sdk import capture_exception
try:
    1 / 0
except Exception as e:
    capture_exception(e)
```

---

## 📈 Application Performance Monitoring

### Prometheus + Grafana Setup

#### 1. Install Prometheus

Create `monitoring/prometheus.yml`:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Frontend Next.js metrics
  - job_name: 'nextjs'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'

  # Backend Django metrics
  - job_name: 'django'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics/'

  # PostgreSQL metrics
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  # Redis metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  # Node exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']

  # Nginx metrics
  - job_name: 'nginx'
    static_configs:
      - targets: ['localhost:9113']
```

#### 2. Install Django Prometheus

```bash
cd erp_backend
pip install django-prometheus
```

Edit `erp_backend/core/settings.py`:
```python
INSTALLED_APPS = [
    'django_prometheus',  # Add at the top
    # ... other apps
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',  # First
    # ... other middleware
    'django_prometheus.middleware.PrometheusAfterMiddleware',  # Last
]

# Prometheus database wrapper
DATABASES = {
    'default': {
        'ENGINE': 'django_prometheus.db.backends.postgresql',
        # ... other settings
    }
}
```

Add metrics endpoint in `erp_backend/core/urls.py`:
```python
from django.urls import path, include

urlpatterns = [
    # ... other patterns
    path('', include('django_prometheus.urls')),
]
```

#### 3. Add Next.js Metrics Endpoint

Create `src/app/api/metrics/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { register } from 'prom-client'

// This endpoint exposes Prometheus metrics
export async function GET() {
  const metrics = await register.metrics()

  return new NextResponse(metrics, {
    headers: {
      'Content-Type': register.contentType,
    },
  })
}
```

Create custom metrics in `src/lib/metrics.ts`:
```typescript
import { Counter, Histogram, Gauge, register } from 'prom-client'

// HTTP request counter
export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
})

// HTTP request duration
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register],
})

// Active users gauge
export const activeUsers = new Gauge({
  name: 'active_users_total',
  help: 'Number of active users',
  registers: [register],
})

// API errors counter
export const apiErrorCounter = new Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['endpoint', 'error_type'],
  registers: [register],
})

// Database query duration
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
})
```

#### 4. Run Prometheus

Using Docker:
```bash
# Create monitoring directory
mkdir -p monitoring

# Run Prometheus
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# Access Prometheus UI at http://localhost:9090
```

#### 5. Install Grafana

```bash
# Run Grafana
docker run -d \
  --name grafana \
  -p 3001:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  grafana/grafana

# Access Grafana at http://localhost:3001
# Default credentials: admin/admin
```

#### 6. Configure Grafana Dashboard

1. Add Prometheus as data source:
   - URL: `http://prometheus:9090`
   - Access: Server

2. Import dashboards:
   - **Node Exporter Full**: Dashboard ID `1860`
   - **Django Prometheus**: Dashboard ID `9528`
   - **PostgreSQL**: Dashboard ID `9628`
   - **Redis**: Dashboard ID `11835`
   - **Nginx**: Dashboard ID `12708`

3. Create custom TSF ERP dashboard with panels:
   - Request rate
   - Error rate
   - Response time (p50, p95, p99)
   - Active users
   - Database connections
   - Cache hit rate
   - Memory usage
   - CPU usage

---

## 📝 Log Aggregation (Loki + Promtail)

### 1. Install Loki

Create `monitoring/loki-config.yml`:
```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h  # 30 days
```

Run Loki:
```bash
docker run -d \
  --name loki \
  -p 3100:3100 \
  -v $(pwd)/monitoring/loki-config.yml:/etc/loki/local-config.yaml \
  -v loki-data:/loki \
  grafana/loki:latest
```

### 2. Install Promtail (Log Shipper)

Create `monitoring/promtail-config.yml`:
```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Django logs
  - job_name: django
    static_configs:
      - targets:
          - localhost
        labels:
          job: django
          __path__: /var/log/django/*.log

  # Next.js logs
  - job_name: nextjs
    static_configs:
      - targets:
          - localhost
        labels:
          job: nextjs
          __path__: /var/log/nextjs/*.log

  # Nginx access logs
  - job_name: nginx-access
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx
          log_type: access
          __path__: /var/log/nginx/access.log

  # Nginx error logs
  - job_name: nginx-error
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx
          log_type: error
          __path__: /var/log/nginx/error.log

  # System logs
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: syslog
          __path__: /var/log/syslog
```

Run Promtail:
```bash
docker run -d \
  --name promtail \
  -v $(pwd)/monitoring/promtail-config.yml:/etc/promtail/config.yml \
  -v /var/log:/var/log \
  grafana/promtail:latest
```

### 3. Configure Django Logging

Edit `erp_backend/core/settings.py`:
```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s'
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/django/app.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 10,
            'formatter': 'json',
        },
        'error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/django/error.log',
            'maxBytes': 10485760,
            'backupCount': 10,
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['console', 'file'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file', 'error_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['error_file'],
            'level': 'ERROR',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['error_file'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}
```

Install JSON logger:
```bash
pip install python-json-logger
```

### 4. Configure Next.js Logging

Create `src/lib/logger.ts`:
```typescript
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,

  // In production, write to file
  ...(process.env.NODE_ENV === 'production' && {
    transport: {
      target: 'pino/file',
      options: { destination: '/var/log/nextjs/app.log' }
    }
  }),
})

export default logger

// Usage:
// logger.info({ userId: 123, action: 'login' }, 'User logged in')
// logger.error({ error: err.message }, 'API call failed')
```

Install Pino:
```bash
npm install pino
```

### 5. Query Logs in Grafana

Add Loki as data source in Grafana:
- URL: `http://loki:3100`
- Access: Server

Example LogQL queries:
```logql
# All Django errors
{job="django"} |= "ERROR"

# API requests with slow response times
{job="django"} | json | duration > 1000

# Failed login attempts
{job="django"} | json | action="login" | status="failed"

# 500 errors
{job="nginx"} | pattern "<_> <method> <path> <status> <_>" | status="500"
```

---

## 🔔 Alerting Setup

### 1. Configure AlertManager

Create `monitoring/alertmanager.yml`:
```yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@tsf.ci'
  smtp_auth_username: 'alerts@tsf.ci'
  smtp_auth_password: 'your_password'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    email_configs:
      - to: 'devops@tsf.ci'

  - name: 'critical'
    email_configs:
      - to: 'devops@tsf.ci,cto@tsf.ci'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts-critical'
        title: '🚨 Critical Alert'

  - name: 'warning'
    email_configs:
      - to: 'devops@tsf.ci'
```

### 2. Create Alert Rules

Create `monitoring/alert-rules.yml`:
```yaml
groups:
  - name: application_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% over the last 5 minutes"

      # Slow response time
      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time (p95)"
          description: "95th percentile response time is {{ $value }}s"

      # High memory usage
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}%"

      # Database connection pool exhausted
      - alert: DatabaseConnectionPoolExhausted
        expr: django_db_connections_current >= django_db_connections_max * 0.9
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value }} connections in use"

      # Disk space low
      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space"
          description: "Only {{ $value }}% disk space remaining"

      # Service down
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "Service has been down for more than 1 minute"
```

### 3. Run AlertManager

```bash
docker run -d \
  --name alertmanager \
  -p 9093:9093 \
  -v $(pwd)/monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml \
  prom/alertmanager
```

Update Prometheus config to use AlertManager:
```yaml
# Add to prometheus.yml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

rule_files:
  - 'alert-rules.yml'
```

---

## 📊 User Analytics (Optional)

### Google Analytics 4

Add to `src/app/layout.tsx`:
```typescript
import Script from 'next/script'

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

---

## 🔐 Security Monitoring

### 1. Failed Login Attempts

Track in Django:
```python
# In authentication view
from django.core.cache import cache

def track_failed_login(username, ip_address):
    key = f'failed_login:{ip_address}'
    attempts = cache.get(key, 0)
    attempts += 1
    cache.set(key, attempts, timeout=3600)  # 1 hour

    if attempts >= 5:
        logger.warning(f'Multiple failed login attempts from {ip_address}')
        # Trigger alert
```

### 2. Suspicious Activity Detection

Create alerts for:
- Multiple failed login attempts
- Access from unusual locations
- Large data exports
- Privilege escalation attempts
- Unusual API usage patterns

### 3. Audit Log Monitoring

Monitor audit logs for:
- Sensitive data access
- Configuration changes
- User permission changes
- Data deletion operations

---

## 📦 Complete Docker Compose Stack

Create `docker-compose.monitoring.yml`:
```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/alert-rules.yml:/etc/prometheus/alert-rules.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana-data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    restart: unless-stopped

  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki-config.yml:/etc/loki/local-config.yaml
      - loki-data:/loki
    restart: unless-stopped

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - ./monitoring/promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    restart: unless-stopped

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: postgres-exporter
    ports:
      - "9187:9187"
    environment:
      - DATA_SOURCE_NAME=postgresql://user:password@postgres:5432/tsf_db?sslmode=disable
    restart: unless-stopped

  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: redis-exporter
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis:6379
    restart: unless-stopped

volumes:
  prometheus-data:
  grafana-data:
  loki-data:
```

Start the monitoring stack:
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

---

## 🎯 Key Metrics to Monitor

### Application Metrics
- Request rate (requests/second)
- Error rate (%)
- Response time (p50, p95, p99)
- Apdex score
- Concurrent users

### Infrastructure Metrics
- CPU usage (%)
- Memory usage (%)
- Disk usage (%)
- Network I/O (MB/s)
- Disk I/O (IOPS)

### Database Metrics
- Query duration
- Connection pool usage
- Cache hit rate
- Slow queries
- Deadlocks

### Business Metrics
- Orders per hour
- Revenue per hour
- Active users
- Conversion rate
- Cart abandonment rate

---

## ✅ Verification

Test monitoring setup:
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Grafana health
curl http://localhost:3001/api/health

# Check Loki
curl http://localhost:3100/ready

# Trigger test alert
curl -X POST http://localhost:9093/api/v1/alerts
```

---

**Monitoring Setup Version**: 1.0.0
**Last Updated**: 2026-03-07
**Maintained By**: DevOps Team
