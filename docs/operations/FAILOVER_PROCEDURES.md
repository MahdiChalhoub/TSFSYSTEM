# Failover Procedures

**Last Updated**: 2026-03-14
**Owner**: DevOps / SRE Team
**Severity**: P0 - Infrastructure Failure

---

## Overview

This runbook covers failover scenarios for TSFSYSTEM's critical infrastructure components:
- Database (PostgreSQL)
- Application servers
- Load balancers
- Cache layer (Redis)

---

## Scenario 1: Primary Database Failure

### Detection
- Database health check fails
- Connection timeout errors
- Replication lag alerts
- Monitoring alerts from Datadog/Prometheus

### Automatic Failover (if configured)

**With Patroni/Keepalived**:
```bash
# System automatically promotes standby
# No manual intervention needed

# Verify failover
patronictl list

# Expected output:
# + Cluster: tsfsystem-db -------+----+-----------+
# | Member   | Host      | Role    | State    |
# +----------+-----------+---------+----------+
# | postgres1| 10.0.1.10 | Replica | running  |
# | postgres2| 10.0.1.11 | Leader  | running  | <-- Promoted
```

### Manual Failover

#### Step 1: Confirm Primary is Down
```bash
# Check primary database
pg_isready -h primary-db.internal

# Check replication status
sudo -u postgres psql -c "SELECT * FROM pg_stat_replication;"
```

#### Step 2: Promote Standby
```bash
# On standby server
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/data

# Wait for promotion
sudo -u postgres psql -c "SELECT pg_is_in_recovery();"
# Should return: false (not in recovery = primary)
```

#### Step 3: Update Application Configuration
```bash
# Option A: Update DNS (recommended)
# Point db.tsfsystem.internal to standby IP

# Option B: Update environment variable
export DATABASE_URL="postgresql://user:pass@standby-db:5432/tsfdb"

# Restart applications
systemctl restart tsfsystem-backend
systemctl restart tsfsystem-celery
```

#### Step 4: Verify Failover
```bash
# Test database connectivity
psql -h standby-db -U postgres -c "SELECT NOW();"

# Run application health check
curl http://localhost:8000/health

# Check application logs
tail -f /var/log/tsfsystem/backend.log
```

### RTO: 5 minutes (automatic), 15 minutes (manual)
### RPO: 0 seconds (synchronous replication), 30 seconds (asynchronous)

---

## Scenario 2: Application Server Failure

### Detection
- Health endpoint returns 500/503
- High error rate in logs
- Server unresponsive

### Recovery Steps

#### With Load Balancer (Auto)
```bash
# Load balancer detects health check failure
# Automatically routes traffic to healthy servers
# No manual action needed

# Verify
curl http://lb.tsfsystem.internal/health
```

#### Manual Server Recovery
```bash
# 1. Mark server as down in load balancer
# HAProxy example:
echo "set server backend/app1 state maint" | socat stdio /var/run/haproxy/admin.sock

# 2. Investigate issue
journalctl -u tsfsystem-backend -n 200

# 3. Attempt restart
systemctl restart tsfsystem-backend

# 4. If restart fails, scale horizontally
# Provision new application server
# or
# Scale existing container deployment

# 5. Re-enable in load balancer
echo "set server backend/app1 state ready" | socat stdio /var/run/haproxy/admin.sock
```

### RTO: 2 minutes (auto), 10 minutes (manual)

---

## Scenario 3: Redis Cache Failure

### Detection
- Redis connection errors
- Session loss
- Cache miss rate spike

### Recovery Steps

#### With Redis Sentinel (Auto)
```bash
# Sentinel automatically promotes replica
# No action needed

# Verify
redis-cli -h redis-sentinel-host SENTINEL masters
```

#### Manual Failover
```bash
# 1. Check Redis status
redis-cli PING
# If no response, Redis is down

# 2. Start Redis
systemctl start redis

# 3. If primary corrupt, promote replica
redis-cli -h replica-host REPLICAOF NO ONE

# 4. Update application config
export REDIS_URL="redis://replica-host:6379"

# 5. Restart applications
systemctl restart tsfsystem-*
```

### RTO: 1 minute (auto), 5 minutes (manual)
### RPO: Acceptable data loss (cache can be rebuilt)

---

## Scenario 4: Complete Data Center Outage

### Detection
- All health checks fail
- Monitoring alerts from multiple services
- Network connectivity loss

### Disaster Recovery Steps

#### 1. Activate DR Site
```bash
# If multi-region deployment exists

# 1. Update DNS to point to DR region
# Change tsf.ci A records to DR load balancer

# 2. Promote DR database to primary
# (See Scenario 1)

# 3. Scale up DR application servers
# Increase capacity to handle full traffic

# 4. Update configuration
# Point applications to DR database

# 5. Monitor closely
# Watch for issues during traffic switchover
```

#### 2. Single Region Recovery
```bash
# 1. Restore from backups
# (See BACKUP_PROCEDURES.md)

# 2. Provision new infrastructure
# Use IaC (Terraform/CloudFormation)

# 3. Deploy application
# Latest stable version from Git

# 4. Restore database
# From S3 backup

# 5. Verify and go live
```

### RTO: 1 hour (multi-region), 4 hours (single region rebuild)
### RPO: 6 hours (backup frequency)

---

## Failover Testing Schedule

| Test Type | Frequency | Description |
|-----------|-----------|-------------|
| Database Failover | Monthly | Promote standby, verify applications |
| Application Failover | Quarterly | Kill primary app server, verify LB |
| Cache Failover | Quarterly | Stop Redis, verify graceful degradation |
| Full DR Drill | Annually | Complete data center failover simulation |

---

## Rollback Procedures

If failover causes issues:

```bash
# 1. Revert DNS changes
# Point back to original servers

# 2. Demote promoted database
sudo -u postgres pg_ctl restart -D /var/lib/postgresql/data

# Configure replication from original primary
sudo -u postgres psql -c "SELECT pg_start_backup('rollback');"

# 3. Restart applications with original config
export DATABASE_URL="postgresql://user:pass@original-db:5432/tsfdb"
systemctl restart tsfsystem-*
```

---

## Communication Plan

### During Failover
1. **Internal**: Slack #incidents channel
2. **Status Page**: Update status.tsfsystem.com
3. **Customer Notifications**: Email to affected organizations
4. **Escalation**: Page on-call SRE if failover fails

### Post-Failover
1. Incident report within 24 hours
2. Root cause analysis
3. Update runbooks if needed

---

## Monitoring & Alerting

**Critical Alerts** (Page immediately):
- Database primary down
- All application servers unhealthy
- Load balancer health check failing

**Warning Alerts** (Slack notification):
- Single app server down
- High replication lag (>30s)
- Cache degraded

---

**Contacts**:
- **SRE On-Call**: +1-555-0102 (PagerDuty)
- **Database Team**: db-team@tsfsystem.com
- **Platform Team**: platform@tsfsystem.com

---

**Change Log**:
- 2026-03-14: Initial version (Wave 3)
