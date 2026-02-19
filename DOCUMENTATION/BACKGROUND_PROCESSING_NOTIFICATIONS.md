# Phase 2 — Background Processing & Notification Engine

## 2.1 Celery Integration

### Goal
Provide automated background task processing for invoice overdue detection, stock monitoring, analytics, backup, and notification delivery.

### Architecture

| Component | File | Purpose |
|-----------|------|---------|
| App Config | `core/celery.py` | Celery application with Redis broker |
| Bootstrap | `core/__init__.py` | Auto-imports celery_app on Django startup |
| Tasks | `erp/tasks.py` | 8 shared_task definitions |
| Schedule | `core/settings.py` | CELERY_BEAT_SCHEDULE with 6 periodic tasks |
| Dependencies | `requirements.txt` | `celery[redis]>=5.3`, `redis>=5.0` |

### Beat Schedule

| Task | Schedule | Purpose |
|------|----------|---------|
| `check_overdue_invoices` | Every hour | Mark sent invoices past due_date as OVERDUE |
| `check_low_stock` | Every 6 hours | Scan products, create StockAlerts |
| `warm_analytics_cache` | Daily 02:00 | Pre-compute dashboard data |
| `cleanup_old_audit_logs` | Weekly Sunday 03:00 | Delete logs >90 days |
| `generate_daily_backup` | Daily 01:00 | Trigger DB backup |
| `send_daily_digest` | Daily 08:00 | Email unread summaries |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CELERY_BROKER_URL` | `redis://127.0.0.1:6379/0` | Redis broker URL |
| `CELERY_RESULT_BACKEND` | `redis://127.0.0.1:6379/1` | Result backend URL |
| `EMAIL_BACKEND` | `console.EmailBackend` | Email backend class |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP host |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_HOST_USER` | `''` | SMTP user |
| `EMAIL_HOST_PASSWORD` | `''` | SMTP password |
| `DEFAULT_FROM_EMAIL` | `ERP System <noreply@tsf.ci>` | Sender address |

### Starting Workers
```bash
# Worker (processes tasks)
celery -A core worker --loglevel=info

# Beat (triggers schedules)
celery -A core beat --loglevel=info

# Both in one process (development)
celery -A core worker --beat --loglevel=info
```

---

## 2.2 Notification Engine

### Goal
Multi-channel notification system with template rendering, user preferences, and email delivery.

### Data Model

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `notification_template` | Reusable message templates | code, channel, language, subject, body |
| `notification_preference` | Per-user channel toggles | user, notification_type, channel, is_enabled |
| `notification_log` | Delivery audit trail | user, channel, subject, status, sent_at |

### Service: `NotificationService`

| Method | Description |
|--------|-------------|
| `send()` | Send via all enabled channels for user |
| `send_async()` | Queue via Celery for async delivery |
| `get_user_preferences()` | Get all preferences with defaults |
| `update_preference()` | Toggle a specific channel for a type |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications/preferences/` | GET | Get user's notification preferences |
| `/api/notifications/update-preference/` | POST | Toggle a channel preference |
| `/api/notifications/delivery-log/` | GET | View delivery history |

### Supported Notification Types

- invoice_overdue, invoice_paid
- stock_alert
- po_approved, po_received
- payment_received
- system_update
- daily_digest

### Frontend Page
`/settings/notifications` — Channel toggle switches per notification type, delivery log feed.
