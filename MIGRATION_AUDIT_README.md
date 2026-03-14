# Migration Audit & Verification - Quick Start Guide

## 📚 What You Asked For

You requested:
1. ✅ **Script to audit an existing migration** → Multiple tools created
2. ✅ **How to query the mapping table** → SQL examples & Python tool
3. ✅ **COA mapping process explained** → Complete documentation

---

## 🎯 Quick Start: Auditing Your Migration

### Option 1: SQL Audit Script (Fastest)

```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM
sudo -u postgres psql tsfdb -f scripts/audit_migration.sql
```

**What it shows:**
- All migration jobs
- Latest job details
- Entity type breakdown (products, contacts, sales)
- Flagged records requiring review
- Validation results (COA check, posting rules)
- Sample migrated data
- Account mappings
- Performance metrics

**Output:** Formatted console report with all audit information

---

### Option 2: Python Audit Tool (Most Detailed)

```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
source venv/bin/activate

# Audit latest job
python scripts/audit_migration.py

# Audit specific job
python scripts/audit_migration.py --job-id 5

# Show only flagged records
python scripts/audit_migration.py --flagged-only

# Export to CSV for Excel analysis
python scripts/audit_migration.py --export csv

# List all jobs
python scripts/audit_migration.py --list-jobs
```

**What it shows:**
- Complete audit report
- Entity summaries with verification rates
- All flagged records with reasons
- Validation errors and warnings
- Sample products and contacts
- Account mapping details
- Performance statistics

**Output:** Formatted console report + optional CSV export

---

## 🔍 How to Query the Mapping Table

### Quick Queries

#### 1. See What Was Migrated (By Entity Type)

```sql
SELECT
    entity_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE verify_status = 'VERIFIED') as verified,
    COUNT(*) FILTER (WHERE verify_status = 'FLAGGED') as flagged
FROM migration_v2_mapping
WHERE job_id = 5  -- Replace with your job ID
GROUP BY entity_type;
```

#### 2. Find Specific Product Mapping

```sql
SELECT
    m.source_id as ultimatepos_product_id,
    m.target_id as tsfsystem_product_id,
    m.source_data->>'name' as original_name,
    m.source_data->>'sku' as original_sku,
    p.name as current_name,
    p.sku as current_sku,
    m.verify_status
FROM migration_v2_mapping m
LEFT JOIN product p ON p.id = m.target_id::uuid
WHERE m.job_id = 5
AND m.entity_type = 'PRODUCT'
AND m.source_data->>'sku' = 'PROD-001';  -- Search by SKU
```

#### 3. Find All Flagged Records

```sql
SELECT
    entity_type,
    source_id,
    target_id,
    source_data->>'name' as record_name,
    verify_notes as reason_flagged,
    created_at
FROM migration_v2_mapping
WHERE job_id = 5
AND verify_status = 'FLAGGED'
ORDER BY entity_type, created_at;
```

#### 4. Track Source → Target for Contact

```sql
SELECT
    m.source_id as ultimatepos_contact_id,
    m.target_id as tsfsystem_counterparty_id,
    m.source_data->>'name' as original_name,
    m.source_data->>'type' as original_type,
    m.source_data->>'mobile' as original_mobile,
    c.name as current_name,
    c.contact_type as current_type,
    c.mobile as current_mobile
FROM migration_v2_mapping m
LEFT JOIN counterparty c ON c.id = m.target_id::uuid
WHERE m.job_id = 5
AND m.entity_type = 'CONTACT'
AND m.source_id = '123';  -- UltimatePOS contact ID
```

#### 5. See Account Mappings (COA)

```sql
SELECT
    m.source_data->>'account_number' as source_account,
    m.source_data->>'name' as source_name,
    m.source_data->>'account_type' as source_type,
    a.code as tsfsystem_account_code,
    a.name as tsfsystem_account_name,
    a.account_type as tsfsystem_account_type
FROM migration_v2_mapping m
JOIN account a ON a.id = m.target_id::uuid
WHERE m.job_id = 5
AND m.entity_type = 'ACCOUNT'
ORDER BY m.source_data->>'account_number';
```

#### 6. Find Transactions with Issues

```sql
SELECT
    m.source_id as ultimatepos_txn_id,
    m.source_data->>'invoice_no' as invoice_number,
    m.source_data->>'final_total' as amount,
    m.source_data->>'payment_status' as payment_status,
    m.verify_status,
    m.verify_notes
FROM migration_v2_mapping m
WHERE m.job_id = 5
AND m.entity_type = 'TRANSACTION'
AND m.verify_status = 'FLAGGED';
```

---

## 📖 Understanding COA Mapping

### What is COA Mapping?

**Chart of Accounts (COA) Mapping** is the process of linking accounts from UltimatePOS to your TSFSYSTEM Chart of Accounts.

**Example:**
```
UltimatePOS → TSFSYSTEM (SYSCOHADA)
"Cash"      → 411001 (Caisse)
"Bank"      → 411002 (Banque)
"Sales"     → 701001 (Ventes de marchandises)
"VAT Out"   → 443001 (TVA Collectée)
```

### Why It Matters

Every financial transaction needs to create **balanced journal entries**:

```
Sale of 12,000 XAF (including 20% VAT):

Debit:  411001 (Cash)                 12,000
Credit: 701001 (Sales)                10,000
Credit: 443001 (VAT Collected)         2,000
----------------------------------------
Total: 12,000 Debit = 12,000 Credit ✅
```

Without proper COA mapping, journal entries won't balance and your financial reports will be incorrect.

### How to Configure COA Mapping

**Step 1: Check your Chart of Accounts**
```sql
SELECT code, name, account_type
FROM account
WHERE organization_id = 'YOUR_ORG_UUID'
ORDER BY code;
```

**Step 2: Update migration job mappings**
```bash
curl -X PATCH https://saas.tsf.ci/api/proxy/migration_v2/jobs/5/ \
  -H "Content-Type: application/json" \
  -d '{
    "account_type_mappings": {
      "cash_account": "411001",
      "bank_account": "411002",
      "sales_account": "701001",
      "sales_vat_account": "443001",
      "purchase_account": "601001",
      "purchase_vat_account": "445001",
      "expense_account": "604001",
      "accounts_receivable": "411100",
      "accounts_payable": "401001"
    }
  }'
```

**Step 3: Verify mappings**
```bash
python scripts/audit_migration.py --job-id 5
```

Check the "CHART OF ACCOUNTS MAPPING" section in the output.

---

## 📂 All Documentation Files

| File | Purpose |
|------|---------|
| **scripts/audit_migration.sql** | PostgreSQL audit script - run directly in psql |
| **erp_backend/scripts/audit_migration.py** | Python audit tool - detailed analysis & CSV export |
| **DOCUMENTATION/MIGRATION_COA_MAPPING.md** | Complete COA mapping guide with examples |
| **DOCUMENTATION/MIGRATION_VERIFICATION_GUIDE.md** | Step-by-step migration verification procedures |
| **MIGRATION_AUDIT_README.md** | This quick start guide |

---

## 🎯 Common Tasks

### Task 1: "I want to see what was migrated"

```bash
# Quick overview
sudo -u postgres psql tsfdb -f scripts/audit_migration.sql

# Detailed report
cd erp_backend && source venv/bin/activate
python scripts/audit_migration.py
```

### Task 2: "I need to find a specific product"

```sql
SELECT
    m.source_id,
    m.target_id,
    m.source_data->>'name' as name,
    m.source_data->>'sku' as sku,
    m.verify_status
FROM migration_v2_mapping m
WHERE m.job_id = 5
AND m.entity_type = 'PRODUCT'
AND m.source_data->>'sku' LIKE '%SEARCH_TERM%';
```

### Task 3: "I want to check if finances are correct"

```sql
-- Check for unbalanced journal entries
SELECT
    je.id,
    je.reference,
    SUM(jel.debit) as total_debit,
    SUM(jel.credit) as total_credit,
    SUM(jel.debit) - SUM(jel.credit) as difference
FROM journal_entry je
JOIN journal_entry_line jel ON jel.journal_entry_id = je.id
WHERE je.created_at >= (SELECT started_at FROM migration_v2_job WHERE id = 5)
GROUP BY je.id, je.reference
HAVING SUM(jel.debit) <> SUM(jel.credit);
```

**Expected:** 0 rows (all balanced)

### Task 4: "I want to export everything to Excel"

```bash
cd erp_backend && source venv/bin/activate
python scripts/audit_migration.py --job-id 5 --export csv
```

Opens in Excel: `migration_5_audit.csv`

### Task 5: "I only want to see problems"

```bash
python scripts/audit_migration.py --job-id 5 --flagged-only
```

### Task 6: "I want to understand the COA mapping"

Read: `DOCUMENTATION/MIGRATION_COA_MAPPING.md`

Or check current mappings:
```sql
SELECT account_type_mappings
FROM migration_v2_job
WHERE id = 5;
```

---

## 🚀 Next Steps

1. **Run initial audit** using SQL or Python tool
2. **Review flagged records** and decide what to do with them
3. **Verify financial integrity** (journal entries balance)
4. **Get user acceptance** - have actual users test the data
5. **Complete verification checklist** from the verification guide
6. **Generate final report** and get stakeholder sign-off

---

## 📞 Need Help?

**Check the documentation:**
- COA Mapping issues → `DOCUMENTATION/MIGRATION_COA_MAPPING.md`
- Verification procedures → `DOCUMENTATION/MIGRATION_VERIFICATION_GUIDE.md`

**Run the audit tools:**
```bash
# SQL audit
sudo -u postgres psql tsfdb -f scripts/audit_migration.sql

# Python audit with details
cd erp_backend && source venv/bin/activate
python scripts/audit_migration.py --job-id YOUR_JOB_ID
```

**Check the mapping table directly:**
```sql
SELECT * FROM migration_v2_mapping WHERE job_id = YOUR_JOB_ID LIMIT 10;
```

---

**Created:** 2026-03-08
**Status:** ✅ Complete - All audit tools and documentation ready
**Tools Available:** SQL Script, Python Tool, COA Guide, Verification Guide
