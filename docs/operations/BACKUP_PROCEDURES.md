# Backup & Restore Procedures

**Last Updated**: 2026-03-14
**Owner**: DevOps / Infrastructure Team

---

## Backup Strategy

### Automated Backups

| Component | Schedule | Retention | Location |
|-----------|----------|-----------|----------|
| **Database (Full)** | Daily 2:00 AM UTC | 30 days | S3 + Glacier |
| **Database (Incremental)** | Every 6 hours | 7 days | S3 |
| **WAL Archive** | Continuous | 7 days | S3 |
| **Application Code** | On deployment | 90 days | Git + S3 |
| **Media Files** | Daily 3:00 AM UTC | 90 days | S3 |
| **Configuration** | On change | Indefinite | Git |

---

## Database Backup

### Automated Daily Backup
```bash
#!/bin/bash
# /opt/tsfsystem/scripts/backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/database"
S3_BUCKET="s3://tsfsystem-backups"

# Create backup
pg_dump -h localhost -U postgres tsfdb | gzip > "$BACKUP_DIR/tsfdb_$TIMESTAMP.sql.gz"

# Upload to S3
aws s3 cp "$BACKUP_DIR/tsfdb_$TIMESTAMP.sql.gz" "$S3_BUCKET/db/daily/"

# Cleanup old local backups (>7 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup complete: tsfdb_$TIMESTAMP.sql.gz"
```

### Manual Backup
```bash
# Full backup
pg_dump tsfdb | gzip > manual_backup_$(date +%Y%m%d).sql.gz

# Schema only
pg_dump -s tsfdb > schema_backup.sql

# Specific table
pg_dump -t finance_invoice tsfdb > invoices_backup.sql
```

---

## File Storage Backup

### Media Files
```bash
#!/bin/bash
# Backup media files to S3

TIMESTAMP=$(date +%Y%m%d)
MEDIA_DIR="/var/www/media"

tar -czf "media_$TIMESTAMP.tar.gz" $MEDIA_DIR
aws s3 cp "media_$TIMESTAMP.tar.gz" s3://tsfsystem-backups/media/

# Delete local archive after upload
rm "media_$TIMESTAMP.tar.gz"
```

---

## Configuration Backup

All configuration tracked in Git:
- `.env` templates (no secrets)
- nginx configs
- systemd service files
- Docker compose files

**Repository**: `tsfsystem-infrastructure` (private Git repo)

---

## Restore Procedures

### Database Restore
```bash
# 1. Stop application
systemctl stop tsfsystem-*

# 2. Download backup from S3
aws s3 cp s3://tsfsystem-backups/db/daily/tsfdb_20260314.sql.gz .

# 3. Drop existing database (CAUTION!)
sudo -u postgres psql -c "DROP DATABASE tsfdb;"
sudo -u postgres psql -c "CREATE DATABASE tsfdb;"

# 4. Restore
gunzip -c tsfdb_20260314.sql.gz | sudo -u postgres psql tsfdb

# 5. Verify
sudo -u postgres psql tsfdb -c "SELECT COUNT(*) FROM core_organization;"

# 6. Restart application
systemctl start tsfsystem-*
```

### Media Files Restore
```bash
# Download from S3
aws s3 cp s3://tsfsystem-backups/media/media_20260314.tar.gz .

# Extract
tar -xzf media_20260314.tar.gz -C /var/www/

# Set permissions
chown -R www-data:www-data /var/www/media/
```

---

## Backup Verification

### Monthly Verification Test
```bash
#!/bin/bash
# Test restore to temporary environment

# 1. Create test database
createdb test_restore_db

# 2. Restore latest backup
gunzip -c /backups/latest/tsfdb.sql.gz | psql test_restore_db

# 3. Run integrity checks
psql test_restore_db -c "SELECT COUNT(*) FROM information_schema.tables;"

# 4. Drop test database
dropdb test_restore_db

echo "✅ Backup verification successful"
```

---

## Disaster Recovery Testing Schedule

- **Quarterly**: Full DR drill (complete system recovery)
- **Monthly**: Database restore test
- **Weekly**: Backup integrity verification

---

## RTO/RPO Targets

| Scenario | RTO | RPO |
|----------|-----|-----|
| Database corruption | 2 hours | 15 minutes |
| Complete data loss | 4 hours | 6 hours |
| Application failure | 15 minutes | 0 |
| File storage loss | 1 hour | 24 hours |

---

**Maintained by**: Infrastructure Team
**Review Frequency**: Quarterly
