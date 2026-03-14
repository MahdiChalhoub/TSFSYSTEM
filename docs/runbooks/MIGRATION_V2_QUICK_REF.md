# 🚀 Migration v2.0 - Quick Reference Card

## 📍 Access Points

| What | URL/Command |
|------|-------------|
| **Django Admin** | https://saas.tsf.ci/tsf-system-kernel-7788/ |
| **API Base** | https://saas.tsf.ci/api/migration-v2/ |
| **Local API** | http://127.0.0.1:8000/api/migration-v2/ |
| **Database** | `sudo -u postgres psql tsfdb` |
| **Logs** | `/var/log/tsfsystem-error.log` |
| **Service** | `sudo systemctl status tsfsystem.service` |

---

## 🔧 Quick Commands

### Verify System Status
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM
bash test_migration_v2_quick.sh
```

### Check Database Tables
```bash
sudo -u postgres psql tsfdb -c "\dt migration_v2*"
```

### Test API (No Auth)
```bash
curl http://127.0.0.1:8000/api/migration-v2/jobs/
# Should return: {"status":"error","code":"NOT_AUTHENTICATED"...}
```

### View Recent Logs
```bash
tail -50 /var/log/tsfsystem-error.log | grep migration_v2
```

### Restart Backend
```bash
sudo systemctl restart tsfsystem.service
```

---

## 📋 API Endpoints

### Create Migration Job
```bash
curl -X POST https://saas.tsf.ci/api/migration-v2/jobs/create-job/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "UltimatePOS Migration - March 2026",
    "target_organization_id": "your-org-uuid",
    "coa_template": "SYSCOHADA"
  }'
```

### Run Validation
```bash
curl -X POST https://saas.tsf.ci/api/migration-v2/jobs/{job_id}/validate/ \
  -H "Authorization: Bearer $TOKEN"
```

### Get Mappings
```bash
curl https://saas.tsf.ci/api/migration-v2/jobs/{job_id}/mappings/ \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🗂️ File Locations

| What | Path |
|------|------|
| **Models** | `erp_backend/apps/migration_v2/models.py` |
| **Validator** | `erp_backend/apps/migration_v2/services/validator.py` |
| **Entity Service** | `erp_backend/apps/migration_v2/services/entity_service.py` |
| **Master Data** | `erp_backend/apps/migration_v2/services/master_data_service.py` |
| **Views** | `erp_backend/apps/migration_v2/views.py` |
| **Admin** | `erp_backend/apps/migration_v2/admin.py` |

---

## 🔍 Database Queries

### Check All Jobs
```sql
SELECT id, name, status, progress_percent, target_organization_id
FROM migration_v2_job
ORDER BY created_at DESC;
```

### Count Mappings by Type
```sql
SELECT entity_type, COUNT(*),
       SUM(CASE WHEN verify_status = 'VERIFIED' THEN 1 ELSE 0 END) as verified
FROM migration_v2_mapping
GROUP BY entity_type;
```

### Latest Validation Results
```sql
SELECT j.name, v.is_valid, v.validated_at,
       jsonb_array_length(v.errors) as error_count
FROM migration_v2_validation_result v
JOIN migration_v2_job j ON v.job_id = j.id
ORDER BY v.validated_at DESC
LIMIT 5;
```

---

## 🎯 Status Check

### ✅ What's Working NOW
- ✅ Backend service running (9 workers)
- ✅ Database tables created (3 tables, 56 columns)
- ✅ API endpoints responding
- ✅ Authentication enforced
- ✅ Module registered in logs
- ✅ Django admin accessible

### 🔧 What's Implemented
- ✅ MigrationValidatorService (COA + posting rules validation)
- ✅ MasterDataMigrationService (units, categories, brands, products)
- ✅ EntityMigrationService (customers + suppliers with auto COA accounts)

### ⏳ What's Placeholder (Ready to Implement)
- ⏳ TransactionMigrationService (sales/purchases with ledger posting)
- ⏳ InventoryMigrationService (stock with reconciliation)
- ⏳ VerificationService (bulk verify, lock, audit export)
- ⏳ Frontend Wizard (9-step UI)
- ⏳ SQL Parser (u739151801_dataPOS.sql)

---

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| **MIGRATION_V2_FINAL_REPORT.md** | Complete deployment summary |
| **MIGRATION_V2_STATUS.md** | Architecture and implementation details |
| **MIGRATION_V2_TESTING_GUIDE.md** | Step-by-step testing instructions |
| **MIGRATION_V2_QUICK_REF.md** | This file (quick reference) |

---

## 🚦 Next Actions

### Option 1: Test Current System
1. Go to: https://saas.tsf.ci/tsf-system-kernel-7788/
2. Find "MIGRATION V2" section
3. Create test migration job
4. Run validation
5. Check error messages

### Option 2: Continue Development
Choose next service to implement:
- **Transaction Service** (sales + ledger posting)
- **Frontend Wizard** (9-step UI)
- **SQL Parser** (extract data from dump)
- **Inventory Reconciliation** (variance detection)

### Option 3: Provide Feedback
- Test the system
- Report any issues
- Request adjustments

---

**Last Updated**: 2026-03-07 01:52 UTC
**Status**: ✅ LIVE & OPERATIONAL
**Version**: 2.0.0
