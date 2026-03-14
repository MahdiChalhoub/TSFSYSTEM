# Migration Verification & Quality Assurance Guide

## 🎯 Purpose

This guide provides step-by-step procedures to verify that data migrated from **UltimatePOS** to **TSFSYSTEM** is accurate, complete, and maintains financial integrity.

---

## 📋 Pre-Migration Checklist

Before starting the migration, verify:

### ✅ Source System (UltimatePOS)
- [ ] **Backup Created** - Full MySQL dump of UltimatePOS database
- [ ] **Data Export Date Recorded** - Note the exact date/time of export
- [ ] **Business Count Known** - How many businesses in the SQL file?
- [ ] **Record Counts** - Known counts for:
  - Products: _______
  - Contacts: _______
  - Sales: _______
  - Purchases: _______
  - Stock Records: _______

### ✅ Target System (TSFSYSTEM)
- [ ] **Organization Created** - Target organization exists
- [ ] **COA Configured** - Chart of Accounts set up (min 10 accounts)
- [ ] **Posting Rules Defined** - Rules for Sales, Purchases, Payments
- [ ] **Users Created** - Migration operator has proper permissions
- [ ] **Backup Created** - TSFSYSTEM database backed up before migration

### ✅ Migration Configuration
- [ ] **Account Mappings Defined** - All UltimatePOS account types mapped
- [ ] **Tax Rates Configured** - VAT/Tax rates match between systems
- [ ] **Currency Settings** - Correct currency code set
- [ ] **Fiscal Year** - Fiscal year dates configured

---

## 🚀 Migration Execution Steps

### Step 1: Upload SQL File

```bash
# Via Web UI
1. Go to: https://saas.tsf.ci/storage/files/upload
2. Category: MIGRATION
3. Upload your UltimatePOS SQL dump

# Via API
curl -X POST https://saas.tsf.ci/api/proxy/storage/files/upload/ \
  -F "file=@ultimatepos_backup.sql" \
  -F "category=MIGRATION" \
  -F "linked_model=migration_v2.MigrationJob"
```

### Step 2: Create Migration Job

```bash
curl -X POST https://saas.tsf.ci/api/proxy/migration_v2/jobs/create-job/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "UltimatePOS Migration - March 2026",
    "target_organization_id": "YOUR_ORG_UUID",
    "coa_template": "SYSCOHADA"
  }'
```

**Record the Job ID:** __________

### Step 3: Link SQL File to Job

```bash
curl -X POST https://saas.tsf.ci/api/proxy/migration_v2/jobs/{JOB_ID}/attach-file/ \
  -H "Content-Type: application/json" \
  -d '{
    "file_uuid": "YOUR_FILE_UUID"
  }'
```

### Step 4: Configure Account Mappings

Edit the job's `account_type_mappings` JSON:

```json
{
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
```

### Step 5: Validate Prerequisites

```bash
curl -X POST https://saas.tsf.ci/api/proxy/migration_v2/jobs/{JOB_ID}/validate/
```

**Expected Response:**
```json
{
  "is_valid": true,
  "coa_summary": {
    "total_accounts": 50,
    "has_basic_types": true
  },
  "posting_rules_summary": {
    "sales_rule": "configured",
    "purchase_rule": "configured"
  },
  "errors": [],
  "warnings": []
}
```

If `is_valid: false`, fix errors before proceeding.

### Step 6: Start Migration

```bash
curl -X POST https://saas.tsf.ci/api/proxy/migration_v2/jobs/{JOB_ID}/start/
```

**Monitor Progress:**
```bash
# Check status every 30 seconds
watch -n 30 'curl -s https://saas.tsf.ci/api/proxy/migration_v2/jobs/{JOB_ID}/ | jq .progress_percent'
```

---

## 🔍 Post-Migration Verification

### Verification Level 1: Record Counts ⭐

Compare record counts between source and target:

```sql
-- TSFSYSTEM: Check migrated counts
SELECT
    entity_type,
    COUNT(*) as records_migrated,
    COUNT(*) FILTER (WHERE verify_status = 'VERIFIED') as verified,
    COUNT(*) FILTER (WHERE verify_status = 'FLAGGED') as flagged
FROM migration_v2_mapping
WHERE job_id = {JOB_ID}
GROUP BY entity_type;
```

**Compare with UltimatePOS:**
```sql
-- UltimatePOS: Original counts
SELECT 'products' as entity, COUNT(*) FROM products;
SELECT 'contacts' as entity, COUNT(*) FROM contacts;
SELECT 'transactions' as entity, COUNT(*) FROM transactions;
```

| Entity | UltimatePOS | TSFSYSTEM | Match? |
|--------|-------------|-----------|--------|
| Products | _____ | _____ | ☐ |
| Contacts | _____ | _____ | ☐ |
| Sales | _____ | _____ | ☐ |
| Purchases | _____ | _____ | ☐ |

### Verification Level 2: Sample Data Comparison ⭐⭐

Pick 10 random records and verify field-by-field:

#### Products
```sql
-- TSFSYSTEM
SELECT
    p.id,
    p.name,
    p.sku,
    p.product_type,
    p.unit_id,
    p.category_id
FROM product p
JOIN migration_v2_mapping m ON m.target_id::uuid = p.id
WHERE m.job_id = {JOB_ID}
AND m.entity_type = 'PRODUCT'
ORDER BY RANDOM()
LIMIT 10;
```

```sql
-- UltimatePOS (cross-reference using source_id)
SELECT
    id,
    name,
    sku,
    type,
    unit_id,
    category_id
FROM products
WHERE id IN (SELECT source_id::int FROM migration_v2_mapping WHERE job_id = {JOB_ID} AND entity_type = 'PRODUCT');
```

**Verify:**
- [ ] Product names match
- [ ] SKUs match
- [ ] Product types correctly mapped
- [ ] Categories exist in TSFSYSTEM

#### Contacts
```sql
-- TSFSYSTEM
SELECT
    c.id,
    c.name,
    c.contact_type,
    c.mobile,
    c.email,
    c.tax_number
FROM counterparty c
JOIN migration_v2_mapping m ON m.target_id::uuid = c.id
WHERE m.job_id = {JOB_ID}
AND m.entity_type = 'CONTACT'
ORDER BY RANDOM()
LIMIT 10;
```

**Verify:**
- [ ] Contact names match
- [ ] Contact types (customer/supplier) correct
- [ ] Phone numbers preserved
- [ ] Email addresses correct

### Verification Level 3: Financial Integrity ⭐⭐⭐

This is the **most critical** verification step.

#### Check Journal Entry Balance

**Every journal entry MUST balance (Debit = Credit):**

```sql
-- Find unbalanced journal entries
SELECT
    je.id,
    je.reference,
    je.transaction_date,
    SUM(jel.debit) as total_debit,
    SUM(jel.credit) as total_credit,
    SUM(jel.debit) - SUM(jel.credit) as difference
FROM journal_entry je
JOIN journal_entry_line jel ON jel.journal_entry_id = je.id
WHERE je.created_at >= (SELECT started_at FROM migration_v2_job WHERE id = {JOB_ID})
GROUP BY je.id, je.reference, je.transaction_date
HAVING SUM(jel.debit) <> SUM(jel.credit);
```

**Expected Result:** **0 rows** (no unbalanced entries)

If any rows returned:
- [ ] Review the transaction in UltimatePOS
- [ ] Check account mapping configuration
- [ ] Verify posting rules
- [ ] Contact finance team if needed

#### Verify Total Sales

```sql
-- TSFSYSTEM: Total sales from migrated transactions
SELECT
    SUM(total_amount) as total_sales
FROM "transaction"
WHERE created_at >= (SELECT started_at FROM migration_v2_job WHERE id = {JOB_ID})
AND transaction_type = 'SALE';
```

```sql
-- UltimatePOS: Total sales
SELECT
    SUM(final_total) as total_sales
FROM transactions
WHERE type = 'sell';
```

**Verify:** Amounts match within acceptable rounding tolerance (±0.1%)

#### Verify Account Balances

```sql
-- TSFSYSTEM: Cash account balance
SELECT
    a.code,
    a.name,
    SUM(jel.debit - jel.credit) as balance
FROM account a
JOIN journal_entry_line jel ON jel.account_id = a.id
WHERE a.code = '411001'  -- Cash account
GROUP BY a.code, a.name;
```

Compare with UltimatePOS cash account balance.

### Verification Level 4: Data Quality Checks ⭐⭐

#### Check for Flagged Records

```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
source venv/bin/activate
python scripts/audit_migration.py --job-id {JOB_ID} --flagged-only
```

**Review each flagged record:**
- [ ] Understand why it was flagged
- [ ] Decide: Accept, Reject, or Manual Fix
- [ ] Document decision

#### Check for Missing References

```sql
-- Products without categories
SELECT COUNT(*)
FROM product p
JOIN migration_v2_mapping m ON m.target_id::uuid = p.id
WHERE m.job_id = {JOB_ID}
AND m.entity_type = 'PRODUCT'
AND p.category_id IS NULL;
```

```sql
-- Contacts without contact type
SELECT COUNT(*)
FROM counterparty c
JOIN migration_v2_mapping m ON m.target_id::uuid = c.id
WHERE m.job_id = {JOB_ID}
AND m.entity_type = 'CONTACT'
AND c.contact_type IS NULL;
```

#### Check for Duplicate Records

```sql
-- Duplicate products by SKU
SELECT
    sku,
    COUNT(*) as count
FROM product
WHERE organization_id = 'YOUR_ORG_UUID'
AND sku IS NOT NULL
GROUP BY sku
HAVING COUNT(*) > 1;
```

### Verification Level 5: User Acceptance Testing ⭐⭐⭐

Have actual users verify:

**Products Module:**
- [ ] Can search for products by name
- [ ] Can search for products by SKU
- [ ] Product details display correctly
- [ ] Stock levels make sense
- [ ] Categories are correct

**Sales Module:**
- [ ] Can view sales history
- [ ] Invoice details are correct
- [ ] Customer information accurate
- [ ] Totals match original invoices

**Finance Module:**
- [ ] Journal entries are balanced
- [ ] Account balances make sense
- [ ] Can generate trial balance report
- [ ] Can generate P&L statement

**Inventory Module:**
- [ ] Stock movements recorded
- [ ] Stock valuation correct
- [ ] Can perform stock adjustments

---

## 🚩 Common Issues & Resolutions

### Issue 1: Products Missing After Migration

**Symptoms:**
- Record count shows 500 products in UltimatePOS
- Only 450 products in TSFSYSTEM

**Investigation:**
```sql
-- Check flagged products
SELECT
    source_id,
    source_data->>'name' as product_name,
    verify_notes
FROM migration_v2_mapping
WHERE job_id = {JOB_ID}
AND entity_type = 'PRODUCT'
AND verify_status IN ('FLAGGED', 'REJECTED');
```

**Common Causes:**
- Products without required fields (name, SKU)
- Duplicate SKUs
- Invalid category references
- Deleted products in source system

**Resolution:**
- Review flagged products
- Decide whether to accept or reject
- Manually create products if needed

### Issue 2: Unbalanced Journal Entries

**Symptoms:**
- Some transactions have unbalanced journal entries

**Investigation:**
```sql
-- Find specific unbalanced entry
SELECT
    je.*,
    jsonb_agg(jsonb_build_object(
        'account', a.code,
        'debit', jel.debit,
        'credit', jel.credit
    )) as lines
FROM journal_entry je
JOIN journal_entry_line jel ON jel.journal_entry_id = je.id
JOIN account a ON a.id = jel.account_id
WHERE je.id = 'PROBLEMATIC_JE_ID'
GROUP BY je.id;
```

**Common Causes:**
- Rounding errors in multi-currency
- Tax calculation differences
- Missing account mappings
- Complex discount scenarios

**Resolution:**
1. Review original transaction in UltimatePOS
2. Check if manual adjustment needed
3. Create correcting journal entry if necessary
4. Document in migration notes

### Issue 3: Contacts Merged Incorrectly

**Symptoms:**
- Multiple UltimatePOS contacts mapped to single TSFSYSTEM contact

**Investigation:**
```sql
-- Find contacts with multiple source IDs
SELECT
    target_id,
    COUNT(*) as source_count,
    string_agg(source_id, ', ') as source_ids
FROM migration_v2_mapping
WHERE job_id = {JOB_ID}
AND entity_type = 'CONTACT'
GROUP BY target_id
HAVING COUNT(*) > 1;
```

**Resolution:**
- Review de-duplication logic
- Manually split contacts if needed
- Update transaction references

---

## ✅ Final Sign-Off Checklist

Before marking migration as complete:

### Data Verification
- [ ] All record counts match (within tolerance)
- [ ] Sample data spot-checked and verified
- [ ] All journal entries balanced
- [ ] Financial totals reconciled
- [ ] No critical flagged records remain

### System Testing
- [ ] Users can access all migrated data
- [ ] All modules function correctly
- [ ] Reports generate successfully
- [ ] No performance issues

### Documentation
- [ ] Migration report generated
- [ ] Flagged records documented
- [ ] Known issues listed
- [ ] Contact mapping decisions recorded
- [ ] Account mapping final version saved

### Stakeholder Approval
- [ ] Finance team reviewed and approved
- [ ] Operations team tested and approved
- [ ] IT team verified technical integrity
- [ ] Management sign-off obtained

### Backup & Recovery
- [ ] Post-migration backup created
- [ ] Rollback procedure documented
- [ ] UltimatePOS database archived
- [ ] Migration logs backed up

---

## 📊 Migration Report Template

```
MIGRATION COMPLETION REPORT
===========================

Migration Job ID: _______
Migration Date: _______
Completed By: _______

SUMMARY STATISTICS:
- Products Migrated: _____ / _____ (___%)
- Contacts Migrated: _____ / _____ (___%)
- Sales Migrated: _____ / _____ (___%)
- Purchases Migrated: _____ / _____ (___%)
- Duration: _____ hours

VERIFICATION RESULTS:
✅ Record Counts: PASS / FAIL
✅ Sample Data: PASS / FAIL
✅ Financial Integrity: PASS / FAIL
✅ Data Quality: PASS / FAIL
✅ User Acceptance: PASS / FAIL

FLAGGED RECORDS:
- Total Flagged: _____
- Accepted: _____
- Rejected: _____
- Pending Review: _____

KNOWN ISSUES:
1. ___________________________
2. ___________________________
3. ___________________________

RECOMMENDATIONS:
1. ___________________________
2. ___________________________

SIGN-OFF:
Finance Team: _______________ Date: _______
Operations Team: _______________ Date: _______
IT Team: _______________ Date: _______
Management: _______________ Date: _______
```

---

## 🆘 Support & Resources

### Audit Tools
```bash
# SQL Audit Script
sudo -u postgres psql tsfdb -f scripts/audit_migration.sql

# Python Audit Tool
cd erp_backend && source venv/bin/activate
python scripts/audit_migration.py --job-id {JOB_ID}

# Export to CSV
python scripts/audit_migration.py --job-id {JOB_ID} --export csv
```

### Documentation
- [COA Mapping Guide](MIGRATION_COA_MAPPING.md)
- [Migration v2 API Documentation](MIGRATION_V2_API.md)
- [Troubleshooting Guide](MIGRATION_TROUBLESHOOTING.md)

### Contact
- Finance Questions: finance-team@company.com
- Technical Issues: it-support@company.com
- Migration Specialist: migration-lead@company.com

---

**Last Updated:** 2026-03-08
**Version:** 1.0.0
**Applies To:** Migration v2 System
