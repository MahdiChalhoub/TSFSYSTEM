# Operations Runbook

## Common Incidents & Responses

### 502 Bad Gateway
**Symptoms**: Users see 502, Nginx error log shows upstream timeout.
```bash
# Diagnose
ssh root@91.99.11.249 'pm2 status && tail -20 /root/current/gunicorn-error.log'

# Fix: Restart frontend
ssh root@91.99.11.249 'pm2 restart tsf-frontend'

# Fix: Restart backend
ssh root@91.99.11.249 'ps aux | grep gunicorn | grep -v grep | head -1 | awk "{print \$2}" | xargs kill -HUP'
```

### Migration Failure on Deploy
**Symptoms**: `ProgrammingError: relation "X" does not exist`
```bash
# Show unapplied migrations
ssh root@91.99.11.249 'cd /root/current/erp_backend && python3 manage.py showmigrations | grep "\[ \]"'

# Apply pending
ssh root@91.99.11.249 'cd /root/current/erp_backend && python3 manage.py migrate'

# If data loss is acceptable (dev only)
ssh root@91.99.11.249 'cd /root/current/erp_backend && python3 manage.py migrate --fake <app> <migration_name>'
```

### Tenant Resolution Errors
**Symptoms**: `Organization matching query does not exist`
```bash
# Check tenant resolution
curl -sk -H "Host: org-slug.developos.shop" https://developos.shop/api/auth/me/

# Verify organization exists
ssh root@91.99.11.249 'cd /root/current/erp_backend && python3 manage.py shell -c "from erp.models import Organization; print(list(Organization.objects.values_list(\"slug\", flat=True)))"'
```

### PM2 Crash Loop
**Symptoms**: Frontend restarting repeatedly
```bash
# Check logs
ssh root@91.99.11.249 'pm2 logs tsf-frontend --err --nostream --lines 30'

# Full restart
ssh root@91.99.11.249 'pm2 delete tsf-frontend; pm2 start /root/current/.next/standalone/server.js --name tsf-frontend --cwd /root/current/.next/standalone && pm2 save'
```

## Health Check Endpoints

| Endpoint | Purpose | Expected |
|---|---|---|
| `/health/` | Basic alive check | HTTP 200 |
| `/health/db/` | Database connectivity | HTTP 200 with DB status |
| `/health/full/` | Full stack check | HTTP 200 with all subsystems |

## Deployment Quick Reference

```bash
# Full deploy (see /deploy-dev workflow)
rsync src/ → server && rsync erp_backend/ → server
npm run build (on server)
pm2 restart + gunicorn HUP

# Backend-only (no rebuild)
rsync erp_backend/ → server
gunicorn HUP

# Frontend-only
rsync src/ → server
npm run build + pm2 restart
```

## Log Analysis

```bash
# Recent backend errors
ssh root@91.99.11.249 'grep -i error /root/current/gunicorn-error.log | tail -20'

# Frontend errors
ssh root@91.99.11.249 'pm2 logs tsf-frontend --err --nostream --lines 20'

# Slow requests (if request logger enabled)
ssh root@91.99.11.249 'grep "duration_ms" /var/log/tsf/*.log | awk -F: "{if (\$NF > 1000) print}"'
```

## Architecture Fitness
```bash
# Run all 13 fitness checks
bash scripts/ci/check-architecture-fitness.sh

# Run backend tests
cd erp_backend && python3 manage.py test -v2

# Run PostingResolver integration tests
cd erp_backend && python3 manage.py test apps.finance.tests.test_posting_resolver -v2
```
