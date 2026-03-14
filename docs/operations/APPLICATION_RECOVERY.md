# Application Recovery Runbook

**Last Updated**: 2026-03-14
**Owner**: DevOps / Platform Team
**Severity**: P0/P1 - Application Outage

---

## Scenario 1: Application Crash / Unresponsive

### Detection
- Health check failures (HTTP 500/503)
- Container/process crashes
- Memory leaks (OOM kills)
- CPU saturation

### Immediate Actions
```bash
# Check application status
systemctl status tsfsystem-backend
systemctl status tsfsystem-celery

# Check logs for errors
journalctl -u tsfsystem-backend -n 100 --no-pager
tail -f /var/log/tsfsystem/error.log

# Check resource usage
docker stats tsfsystem-backend
htop
```

### Recovery Steps

#### Simple Restart
```bash
# Restart backend
systemctl restart tsfsystem-backend

# Restart workers
systemctl restart tsfsystem-celery

# Clear Redis cache (if needed)
redis-cli FLUSHALL

# Restart frontend
pm2 restart tsfsystem-frontend
```

#### Full Application Recovery
```bash
# 1. Stop all services
systemctl stop tsfsystem-*

# 2. Clear temp files
rm -rf /tmp/tsfsystem/*

# 3. Reset application state
redis-cli FLUSHDB

# 4. Start services in order
systemctl start postgresql
systemctl start redis
systemctl start tsfsystem-backend
systemctl start tsfsystem-celery
systemctl start tsfsystem-frontend

# 5. Wait for health checks
curl -f http://localhost:8000/health || echo "Backend not ready"
curl -f http://localhost:3000/api/health || echo "Frontend not ready"
```

### Verification
```bash
# Run smoke tests
bash scripts/smoke-tests.js

# Check critical endpoints
curl http://localhost:8000/api/core/organizations/
curl http://localhost:8000/api/inventory/products/
```

### RTO: 15 minutes

---

## Scenario 2: Memory Leak / OOM

### Detection
- Application slowly consuming memory
- OOM killer messages in syslog
- Swap usage increasing

### Recovery Steps
```bash
# 1. Identify memory hog
docker stats
ps aux --sort=-%mem | head -20

# 2. Restart affected service
systemctl restart tsfsystem-backend

# 3. Monitor memory growth
watch -n 5 'free -h'

# 4. If leak persists, scale down features
# Disable non-critical background jobs
```

### RTO: 30 minutes

---

## Scenario 3: Deployment Rollback

### When to Rollback
- New deployment causing errors
- Performance regression
- Critical bug introduced

### Rollback Procedure
```bash
# Git-based rollback
cd /opt/tsfsystem
git log --oneline -10  # Find previous stable version
git revert <commit-hash>

# Docker rollback
docker pull tsfsystem/backend:previous-stable
docker-compose up -d

# Database migration rollback (CAREFUL!)
python manage.py migrate <app> <previous_migration>
```

### RTO: 10 minutes

---

## Contact
**Platform Team**: platform@tsfsystem.com
**On-Call**: +1-555-0101

---

**Last Updated**: 2026-03-14
