# Chart of Accounts (COA) Mapping in Migration v2

## 📖 Overview

When migrating from **UltimatePOS** to **TSFSYSTEM**, one of the most critical steps is mapping accounts from the source system to your target Chart of Accounts (COA). This ensures that all financial transactions maintain proper double-entry accounting integrity.

---

## 🎯 Why COA Mapping Matters

### In UltimatePOS
- Uses a **simple account structure** (Cash, Bank, Sales, Purchases)
- Limited account types
- Minimal chart of accounts hierarchy
- Often uses account **names** rather than structured codes

### In TSFSYSTEM
- Uses **standardized COA** (SYSCOHADA, PCGR-MA, IFRS, etc.)
- Hierarchical account structure with **numeric codes**
- Double-entry bookkeeping with journal entries
- Every transaction must **balance** (Debit = Credit)

### Example:
```
UltimatePOS:
  Sale → "Sales Account" (single entry)

TSFSYSTEM:
  Sale → Debit: Cash/Bank (411xxx)
         Credit: Sales Revenue (701xxx)
         Credit: VAT Collected (443xxx)
```

---

## 🔧 How Migration v2 Handles COA Mapping

### Phase 1: Pre-Flight Validation

Before migration starts, the system checks:

1. **Does the target organization have a COA configured?**
   - Minimum 10 accounts required
   - Must have at least basic account types (Asset, Liability, Equity, Revenue, Expense)

2. **Are posting rules defined?**
   - Rules for Sales transactions
   - Rules for Purchase transactions
   - Rules for Payment transactions

3. **Are account type mappings configured?**
   - What TSFSYSTEM account maps to "Cash" in UltimatePOS?
   - What TSFSYSTEM account maps to "Sales" in UltimatePOS?
   - What TSFSYSTEM account maps to "Purchases" in UltimatePOS?

### Phase 2: Account Mapping

The migration system uses a **mapping table** to track account conversions:

```sql
-- migration_v2_job.account_type_mappings (JSONB field)
{
  "cash_account": "411001",        -- TSFSYSTEM account code for Cash
  "bank_account": "411002",        -- TSFSYSTEM account code for Bank
  "sales_account": "701001",       -- TSFSYSTEM account code for Sales Revenue
  "sales_vat_account": "443001",   -- TSFSYSTEM account code for VAT Collected
  "purchase_account": "601001",    -- TSFSYSTEM account code for Purchases
  "purchase_vat_account": "443002",-- TSFSYSTEM account code for VAT Paid
  "expense_account": "604001",     -- TSFSYSTEM account code for General Expenses
  "accounts_receivable": "411100", -- TSFSYSTEM account code for A/R
  "accounts_payable": "401001"     -- TSFSYSTEM account code for A/P
}
```

### Phase 3: Transaction Posting

When a transaction is migrated:

1. **Read UltimatePOS transaction**
   - Invoice #INV-001
   - Amount: 12,000 (including 20% VAT)
   - Payment: Cash
   - Customer: ABC Company

2. **Apply posting rules**
   ```
   TSFSYSTEM Journal Entry:

   Debit:  411001 (Cash)                 12,000
   Credit: 701001 (Sales Revenue)        10,000
   Credit: 443001 (VAT Collected)         2,000
   -------------------------------------------
   Total Debit: 12,000 | Total Credit: 12,000 ✅
   ```

3. **Create migration mapping record**
   ```python
   MigrationMapping.objects.create(
       job=migration_job,
       entity_type='TRANSACTION',
       source_id='12345',  # UltimatePOS transaction ID
       target_id='uuid-xxx',  # TSFSYSTEM transaction UUID
       source_data={
           'invoice_no': 'INV-001',
           'final_total': 12000,
           'payment_method': 'cash',
           ...
       },
       transformed_data={
           'journal_entry_id': 'uuid-yyy',
           'lines': [
               {'account': '411001', 'debit': 12000, 'credit': 0},
               {'account': '701001', 'debit': 0, 'credit': 10000},
               {'account': '443001', 'debit': 0, 'credit': 2000}
           ]
       },
       verify_status='VERIFIED'  # Auto-verified because it balanced
   )
   ```

---

## 📊 COA Mapping Configuration

### Method 1: Via Django Admin

1. Go to TSFSYSTEM Admin → Migration v2 → Jobs
2. Select your migration job
3. Edit "Account Type Mappings" JSON field:

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

### Method 2: Via API

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

### Method 3: Via Django Shell

```python
from apps.migration_v2.models import MigrationJob

job = MigrationJob.objects.get(id=5)
job.account_type_mappings = {
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
job.save()
```

---

## 🧪 Verifying COA Mappings

### Step 1: Check Account Mapping Records

```sql
-- View all account mappings
SELECT
    source_id,
    source_data->>'account_number' as source_account,
    source_data->>'name' as source_name,
    target_id,
    transformed_data->>'account_code' as target_account
FROM migration_v2_mapping
WHERE job_id = 5
AND entity_type = 'ACCOUNT'
ORDER BY source_id::int;
```

### Step 2: Verify Journal Entry Balance

```sql
-- Check if all journal entries balance
SELECT
    je.id,
    je.reference,
    je.transaction_date,
    SUM(jel.debit) as total_debit,
    SUM(jel.credit) as total_credit,
    CASE
        WHEN SUM(jel.debit) = SUM(jel.credit) THEN '✅ BALANCED'
        ELSE '❌ UNBALANCED'
    END as status
FROM journal_entry je
JOIN journal_entry_line jel ON jel.journal_entry_id = je.id
WHERE je.created_at > (SELECT started_at FROM migration_v2_job WHERE id = 5)
GROUP BY je.id, je.reference, je.transaction_date
HAVING SUM(jel.debit) <> SUM(jel.credit);  -- Only show unbalanced entries
```

### Step 3: Use Python Audit Tool

```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
source venv/bin/activate
python scripts/audit_migration.py --job-id 5
```

---

## 🚩 Common Mapping Issues & Solutions

### Issue 1: Account Code Not Found

**Symptom:**
```
Migration failed: Account code '411001' does not exist in COA
```

**Solution:**
1. Check your organization's Chart of Accounts:
```sql
SELECT code, name, account_type
FROM account
WHERE organization_id = 'your-org-uuid'
ORDER BY code;
```

2. Update mapping to use existing account codes

### Issue 2: Journal Entry Doesn't Balance

**Symptom:**
```
Transaction ID 12345 flagged: Journal entry debit/credit mismatch
```

**Solution:**
1. Check the transaction in UltimatePOS:
```sql
-- In UltimatePOS database
SELECT * FROM transactions WHERE id = 12345;
```

2. Review posting rules - may need custom handling for:
   - Rounding differences
   - Multi-currency transactions
   - Complex discount calculations

### Issue 3: Missing Account Type

**Symptom:**
```
Cannot determine account for payment type: 'card'
```

**Solution:**
Add the missing account type to mappings:
```json
{
  ...existing mappings...,
  "card_account": "411003"  // Add card payment account
}
```

---

## 📋 COA Mapping Checklist

Before starting migration, ensure:

- [ ] Target organization has COA configured (min 10 accounts)
- [ ] All required account types are mapped
- [ ] Posting rules are defined for Sales, Purchases, Payments
- [ ] Test migration run completed successfully with sample data
- [ ] All journal entries from test run balanced correctly
- [ ] Account codes match your organization's COA structure
- [ ] VAT/Tax accounts are correctly mapped
- [ ] Accounts Receivable/Payable accounts exist

---

## 🎓 Best Practices

### 1. Use Standard COA Templates
- SYSCOHADA for West Africa
- PCGR-MA for Morocco
- IFRS for international companies
- Custom templates for specific industries

### 2. Create Dedicated Migration Accounts
Consider creating temporary accounts for migration:
- `999001` - Migration Suspense Account (for unbalanced entries)
- `999002` - Migration Rounding Differences
- `999003` - Migration Data Errors

### 3. Review Before Production
Always:
1. Run test migration to staging environment
2. Audit all mappings using audit scripts
3. Verify sample transactions manually
4. Check flagged records
5. Get finance team sign-off

### 4. Document Custom Mappings
Keep a record of:
- Why specific accounts were chosen
- Any custom posting rules created
- Known limitations or approximations
- Contact person for questions

---

## 📞 Support

For COA mapping questions:
1. Review this documentation
2. Run audit scripts to identify issues
3. Check migration_v2_mapping table for flagged records
4. Contact finance team for account code verification

---

**Last Updated:** 2026-03-08
**Applies To:** Migration v2 (apps/migration_v2/)
