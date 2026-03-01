# Migration Audit Strategy — Deep Scenario Analysis
## TSF System — UPOS → TSF Migration

---

## 1. Current State Analysis

### Data Volume (from live DB)
| Entity Type     | Records  | Status                        |
|-----------------|----------|-------------------------------|
| TRANSACTION     | 258,485  | 128,842 COMPLETED, 16,354 DRAFT |
| JOURNAL_ENTRY   | 191,587  | 49,097 POSTED, 60,582 DRAFT  |
| PAYMENT         | 130,481  |                               |
| ORDER_LINE      | 44,000   |                               |
| PRODUCT         | 12,032   |                               |
| EXPENSE         | 1,863    |                               |
| CONTACT         | 767      | 108 CUSTOMER, 659 SUPPLIER    |
| COMBO_LINK      | 615      |                               |
| ACCOUNT         | 319      |                               |
| CATEGORY        | 218      |                               |
| USER            | 110      |                               |
| UNIT            | 60       |                               |
| BRAND           | 29       |                               |
| SITE            | 10       |                               |

### Posting Rules (from Organization Settings)
```json
{
  "sales": { "receivable": 8, "revenue": 25, "cogs": 30, "inventory": 9 },
  "purchases": { "payable": 19, "inventory": 9, "tax": 20 },
  "automation": { "customerRoot": 8, "supplierRoot": 19, "payrollRoot": 142 }
}
```
- **COA 8** = `1110 – Accounts Receivable` (ASSET) — parent for all customer sub-ledgers
- **COA 19** = `2101 – Accounts Payable` (LIABILITY) — parent for all supplier sub-ledgers

---

## 2. Critical Issues Found

### ISSUE #1: Contacts Not Linked to Ledger (CRITICAL)
- **What**: All 767 migrated contacts have `linked_account_id = NULL`
- **Why**: The migration service (`services_entities.py` line 334) calls `Contact.objects.create()` directly, without calling `LedgerService.create_linked_account()` like the normal `ContactViewSet.create()` does.
- **Impact**: No sub-ledger accounts exist for any customer or supplier. This means:
  - Customer balances (AR) cannot be tracked per-customer
  - Supplier balances (AP) cannot be tracked per-supplier
  - Journal entries cannot link to the correct sub-account
  - Trial balance for AR/AP is a single lump sum with no breakdown

#### Fix Strategy:
For each migrated contact:
1. Read posting rules: `customerRoot` (COA 8) or `supplierRoot` (COA 19)
2. Call `LedgerService.create_linked_account()` which:
   - Creates a **ChartOfAccount child** under the parent (e.g., `1110-0001 – PRO BUDGET (AP)`)
   - Sets `parent_id` = COA parent ID
   - Generates sequential code `{parent.code}-{NNNN}`
3. Set `contact.linked_account_id` = new COA child ID

This is exactly what `ContactViewSet.create()` does (line 59-81).

### ISSUE #2: Migrated Contacts Created FinancialAccount Instead of COA Child (REGRESSION)
- **What**: The previous `bulk-link-ledger` endpoint I created was wrong — it created `FinancialAccount` records instead of `ChartOfAccount` children. 
- **Impact**: The 265 contacts that were "linked" have wrong links (to FinancialAccount, not COA child)
- **Fix**: Must be completely rewritten to use `LedgerService.create_linked_account()`.

### ISSUE #3: 16,354 Draft Transactions 
- **What**: 16,354 orders imported as DRAFT (migration error: `"Order() got unexpected keyword arguments: 'discount'"`)
- **Impact**: These orders are incomplete — they couldn't be fully imported
- **Audit Question**: Should they be approved or re-imported?

### ISSUE #4: Journal Entries Quality
- **What**: 109,588 journal entries created by migration (all reference `MIG-AT-*`)
- **Structure**: Each JE has 2 lines:
  - DR: `6000 – OPERATING EXPENSES`
  - CR: `5700 – Cash & Bank (Migration)`
- **Problem**: ALL migrated JEs use a generic migration suspense account, NOT the proper posting rules
  - Sales should DR Receivable/Cash, CR Revenue + CR Tax
  - COGS should DR CoGS, CR Inventory
- **Impact**: Trial Balance is distorted — all revenue appears under "Operating Expenses" instead of "Sales Revenue"

### ISSUE #5: No Contact Link on Journal Entry Lines
- **What**: Journal entry lines (`journalentryline`) have a `contact_id` column, but migrated JEs don't set it
- **Impact**: Cannot generate per-customer or per-supplier account statements from the ledger

---

## 3. Audit Scenarios (Entity-by-Entity)

### 3A. CONTACTS Audit
**Questions the auditor must answer:**
1. ✅ Is the contact imported with correct name, type, phone?
2. ❌ Does this contact have a sub-ledger account (COA child)?
3. ❌ Is the sub-ledger under the correct COA parent? (Customers → 1110, Suppliers → 2101)
4. ❌ For "BOTH" type contacts — do they have TWO sub-ledger accounts?

**Actions Available:**
- **Auto-Fix ALL**: Read posting rules → create COA children → link contacts (no user input needed)
- **Verify**: Show each contact with its linked COA child account

### 3B. TRANSACTIONS Audit
**Questions the auditor must answer:**
1. ✅ Is the transaction amount correct? (source total vs TSF total)
2. ❌ Does this transaction have a proper journal entry? (not MIG-AT suspense)
3. ❌ Is the journal entry using correct accounts? (Revenue, COGS, Inventory, AR/Cash)
4. ❌ Is the journal entry linked to the correct contact sub-ledger?
5. ❌ Is the total debit = total credit on the JE?

**Display per row:**
- LEFT (Source): original UPOS transaction data (amount, date, customer, payment method)
- RIGHT (TSF): order ref, status, total TTC, payment method
- BOTTOM: Journal voucher lines showing DR/CR with account names + balanced check

**Actions Available:**
- **Re-post to Ledger**: Delete old MIG-AT JEs, re-create proper JEs using posting rules
- **Approve Drafts**: Change DRAFT → COMPLETED for clean imports

### 3C. EXPENSES Audit
**Questions:**
1. ✅ Is the expense amount correct?
2. ❌ Does this expense have a proper journal entry?
3. ❌ Is the JE debiting the correct expense account?

### 3D. ACCOUNTS Audit
**Questions:**
1. ✅ Is the account imported with correct name and type?
2. ❌ Is this account mapped to the correct COA entry? (`ledger_account_id`)
3. ❌ Is the opening balance correctly carried over?

### 3E. PRODUCTS Audit
**Questions:**
1. ✅ Is the product imported with correct name, SKU, prices?
2. ✅ Is the product status correct? (ACTIVE vs DRAFT)
3. ❌ Are combo links preserved for combo products?

---

## 4. Recommended Audit Page Flow

### Step 1: Strategy Dashboard (auto-diagnostic)
When opening the audit page for any entity type, show:
- Aggregate statistics (totals, linked/unlinked, draft/active)
- **Detected issues** with red/amber indicators
- **One-click fix buttons** that use posting rules automatically

### Step 2: Record Table (verification)
Below the dashboard, paginated table where each row shows:
- Source data (what was imported)
- TSF data (how it was saved + ledger status)
- Expand to see journal entries, sub-ledger links, etc.

### Step 3: Bulk Actions
At the bottom/top of the page:
- "Fix All Contacts" → auto-creates COA children using posting rules
- "Re-post All to Ledger" → recreates journal entries using correct posting rules  
- "Approve All Drafts" → marks clean records as completed

---

## 5. Implementation Priority

| Priority | Task | Complexity |
|----------|------|------------|
| P0 | Fix bulk-link-ledger to use `LedgerService.create_linked_account()` + auto-read posting rules | Medium |
| P0 | Auto-link contacts on the audit page (no manual COA selection) | Low |
| P1 | Show ledger link status per contact in the table | Low |
| P1 | Show journal entries per transaction in the table | Medium |
| P2 | Re-post journal entries using correct posting rules | High |
| P2 | Link journal entry lines to contact sub-ledgers | High |
