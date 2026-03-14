# Database Recovery Runbook

**Last Updated**: 2026-03-14
**Owner**: DevOps / Database Team
**Severity**: P0 - Critical Infrastructure

---

## Table of Contents
1. [Scenario 1: Database Corruption](#scenario-1-database-corruption)
2. [Scenario 2: Accidental Data Deletion](#scenario-2-accidental-data-deletion)
3. [Scenario 3: Complete Database Loss](#scenario-3-complete-database-loss)
4. [Scenario 4: Performance Degradation](#scenario-4-performance-degradation)

---

## Scenario 1: Database Corruption

### Detection
- Database connection errors
- Inconsistent query results
- PostgreSQL error logs showing corruption messages
- Data integrity check failures

### Immediate Actions
1. **Stop all application servers** to prevent further writes
   ```bash
   systemctl stop tsfsystem-backend
   systemctl stop tsfsystem-celery
   ```

2. **Isolate the database**
   ```bash
   # Set database to read-only mode
   sudo -u postgres psql tsfdb -c "ALTER DATABASE tsfdb SET default_transaction_read_only = on;"
   ```

3. **Identify corrupt tables**
   ```bash
   sudo -u postgres pg_dump tsfdb --test-only 2>&1 | grep ERROR
   ```

### Recovery Steps

#### Option A: Repair Corruption (if limited scope)
```bash
# Reindex affected tables
sudo -u postgres psql tsfdb -c "REINDEX TABLE table_name;"

# Vacuum analyze
sudo -u postgres psql tsfdb -c "VACUUM FULL ANALYZE table_name;"
```

#### Option B: Restore from Backup (if extensive corruption)
```bash
# 1. Stop database
sudo systemctl stop postgresql

# 2. Backup corrupt database
sudo -u postgres mv /var/lib/postgresql/data /var/lib/postgresql/data.corrupt

# 3. Restore from latest backup
sudo -u postgres gunzip -c /backups/latest/tsfdb.sql.gz | psql tsfdb

# 4. Replay WAL logs from backup point to corruption time
sudo -u postgres pg_waldump /backups/wal/000000010000000100000042

# 5. Start database
sudo systemctl start postgresql
```

### Verification
```bash
# Check database integrity
sudo -u postgres psql tsfdb -c "SELECT pg_database_size('tsfdb');"

# Test critical queries
sudo -u postgres psql tsfdb -c "SELECT COUNT(*) FROM core_organization;"

# Verify data consistency
python manage.py shell -c "from apps.finance.models import Invoice; print(Invoice.objects.count())"
```

### Post-Recovery
1. Restart application servers
2. Monitor error logs for 1 hour
3. Run smoke tests
4. Create incident report

### RTO (Recovery Time Objective)
- **Target**: 2 hours
- **Maximum**: 4 hours

### RPO (Recovery Point Objective)
- **Target**: 15 minutes (WAL archiving interval)
- **Maximum**: 1 hour (backup frequency)

---

## Scenario 2: Accidental Data Deletion

### Detection
- User reports missing data
- Audit logs show DELETE/UPDATE operations
- Sudden drop in record counts

### Immediate Actions
1. **Identify deletion time** from audit logs
   ```sql
   SELECT * FROM core_auditlog
   WHERE action = 'DELETE'
   AND model = 'Invoice'
   ORDER BY timestamp DESC
   LIMIT 100;
   ```

2. **Freeze current state** (prevent overwrites)
   ```bash
   # Create snapshot
   sudo -u postgres pg_dump tsfdb --schema-only > schema_backup.sql
   ```

### Recovery Steps

#### Option A: Point-in-Time Recovery (PITR)
```bash
# 1. Create recovery clone database
sudo -u postgres createdb tsfdb_recovery

# 2. Restore from backup taken before deletion
sudo -u postgres gunzip -c /backups/hourly/tsfdb_20260314_0900.sql.gz | psql tsfdb_recovery

# 3. Replay WAL logs up to deletion time
sudo -u postgres pg_waldump --start=000000010000000100000042 --end=000000010000000100000043

# 4. Extract deleted records
sudo -u postgres psql tsfdb_recovery -c "COPY (SELECT * FROM finance_invoice WHERE id IN (123, 456)) TO '/tmp/recovered_invoices.csv' CSV HEADER;"

# 5. Import to production
psql tsfdb -c "\\copy finance_invoice FROM '/tmp/recovered_invoices.csv' CSV HEADER;"
```

#### Option B: Audit Log Reconstruction
```python
# If deletion was recent, reconstruct from audit logs
from apps.core.models import AuditLog

deleted_records = AuditLog.objects.filter(
    action='DELETE',
    model='Invoice',
    timestamp__gte='2026-03-14 10:00:00'
)

for log in deleted_records:
    # Recreate record from changes field
    Invoice.objects.create(**log.changes)
```

### Verification
```bash
# Verify record count
sudo -u postgres psql tsfdb -c "SELECT COUNT(*) FROM finance_invoice;"

# Cross-check with backup
diff <(psql tsfdb -c "SELECT id FROM finance_invoice ORDER BY id;") <(psql tsfdb_recovery -c "SELECT id FROM finance_invoice ORDER BY id;")
```

### RTO
- **Target**: 1 hour
- **Maximum**: 2 hours

### RPO
- **Target**: 0 minutes (real-time audit logs)
- **Maximum**: 15 minutes (transaction log granularity)

---

## Scenario 3: Complete Database Loss

### Detection
- Database server offline
- Disk failure
- Ransomware attack
- Data center outage

### Immediate Actions
1. **Declare P0 incident**
2. **Activate disaster recovery plan**
3. **Spin up standby database** (if available)
4. **Notify stakeholders**

### Recovery Steps

#### Full Recovery from Backup
```bash
# 1. Provision new database server
# (Use IaC/Terraform if available)

# 2. Install PostgreSQL
sudo apt-get install postgresql-14

# 3. Restore from latest full backup
sudo -u postgres gunzip -c /backups/daily/tsfdb_20260314.sql.gz | psql

# 4. Apply incremental backups
for backup in /backups/incremental/*; do
  sudo -u postgres gunzip -c $backup | psql tsfdb
done

# 5. Replay WAL logs
sudo -u postgres pg_waldump /backups/wal/* | psql tsfdb

# 6. Update connection strings
# Update DATABASE_URL in environment
```

#### Failover to Standby (if configured)
```bash
# 1. Promote standby to primary
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/data

# 2. Update DNS to point to new primary
# or update load balancer configuration

# 3. Restart applications with new connection string
```

### Verification
```bash
# Full system smoke test
bash scripts/smoke-tests.js

# Data integrity checks
python manage.py check_data_integrity

# Business logic tests
npm run test:backend
```

### RTO
- **Target**: 4 hours
- **Maximum**: 8 hours

### RPO
- **Target**: 1 hour (hourly backups)
- **Maximum**: 24 hours (daily backups)

---

## Scenario 4: Performance Degradation

### Detection
- Query response times >500ms
- Connection pool exhaustion
- CPU/memory saturation
- Slow query logs

### Immediate Actions
1. **Identify slow queries**
   ```sql
   SELECT query, calls, total_time, mean_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 20;
   ```

2. **Kill long-running queries** (if blocking)
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';
   ```

### Recovery Steps
```bash
# 1. VACUUM ANALYZE
sudo -u postgres psql tsfdb -c "VACUUM ANALYZE;"

# 2. Reindex problematic tables
sudo -u postgres psql tsfdb -c "REINDEX DATABASE tsfdb;"

# 3. Update statistics
sudo -u postgres psql tsfdb -c "ANALYZE;"

# 4. Check for missing indexes
# Review slow query log and add indexes
```

### RTO
- **Target**: 30 minutes
- **Maximum**: 1 hour

---

## Backup Schedule

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Full | Daily 2:00 AM | 30 days | S3 |
| Incremental | Every 6 hours | 7 days | S3 |
| WAL Archive | Continuous | 7 days | S3 |
| Snapshot | Weekly (Sunday) | 90 days | S3 |

## Backup Commands

### Manual Full Backup
```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/manual/tsfdb_$TIMESTAMP.sql.gz"

sudo -u postgres pg_dump tsfdb | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://tsfsystem-backups/db/manual/

echo "Backup complete: $BACKUP_FILE"
```

### Verify Backup Integrity
```bash
# Test restore to temporary database
gunzip -c backup.sql.gz | sudo -u postgres psql test_restore_db

# Compare record counts
psql -d tsfdb -c "SELECT COUNT(*) FROM finance_invoice;" > /tmp/prod_count.txt
psql -d test_restore_db -c "SELECT COUNT(*) FROM finance_invoice;" > /tmp/backup_count.txt
diff /tmp/prod_count.txt /tmp/backup_count.txt
```

---

## Contact Information

**Database Administrator**: db-team@tsfsystem.com
**On-Call**: +1-555-0100 (PagerDuty)
**Escalation**: CTO (critical incidents)

---

## Related Runbooks
- [APPLICATION_RECOVERY.md](./APPLICATION_RECOVERY.md)
- [BACKUP_PROCEDURES.md](./BACKUP_PROCEDURES.md)
- [FAILOVER_PROCEDURES.md](./FAILOVER_PROCEDURES.md)

---

**Change Log**:
- 2026-03-14: Initial version (Wave 3)
