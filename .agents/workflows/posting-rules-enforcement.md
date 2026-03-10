---
description: Mandatory checklist for any code that creates journal entries, financial accounts, or ledger postings — enforces dynamic COA resolution from posting rules
---

# Posting Rules Enforcement Workflow

> **IRON RULE**: No financial transaction may reference a hardcoded COA code.
> Every COA account ID must be resolved dynamically from `ConfigurationService.get_posting_rules(organization)`.
> Every missing rule must raise an explicit, user-facing error — **never silent skip, never `return None`, never `except: pass`**.

---

## WHEN TO USE THIS WORKFLOW

Apply this workflow **any time** you are writing or modifying code that:

- Creates a `JournalEntry` (via `LedgerService.create_journal_entry`)  
- Creates a `FinancialAccount` (needs a parent COA link)
- Creates a CRM `Contact` with a linked ledger account
- Creates an `Employee` with payroll/capital accounts
- Posts stock movements (receive, adjust, transfer)
- Posts asset acquisitions, depreciation, or deferred expenses
- Posts POS checkout sales, COGS, or A/R clearance
- Posts vouchers, payments, or reconciliation entries
- Migrates data that touches the Chart of Accounts

---

## STEP 1 — Resolve accounts from posting rules

```python
from erp.services import ConfigurationService

rules = ConfigurationService.get_posting_rules(organization)

# Access the specific section and key you need:
account_id = rules.get('sales', {}).get('receivable')      # sales.receivable
account_id = rules.get('purchases', {}).get('payable')      # purchases.payable
account_id = rules.get('suspense', {}).get('reception')     # suspense.reception
account_id = rules.get('inventory', {}).get('adjustment')   # inventory.adjustment
account_id = rules.get('automation', {}).get('customerRoot') # automation.customerRoot
# etc.
```

### Available posting rule keys (full list):

| Section | Keys |
|---------|------|
| `sales` | `receivable`, `revenue`, `cogs`, `inventory`, `round_off`, `discount`, `vat_collected` |
| `purchases` | `payable`, `inventory`, `vat_recoverable`, `airsi_payable`, `reverse_charge_vat`, `discount_earned`, `delivery_fees`, `airsi` |
| `inventory` | `adjustment`, `transfer` |
| `tax` | `vat_payable`, `vat_refund_receivable` |
| `suspense` | `reception` |
| `equity` | `capital`, `draws` |
| `partners` | `capital`, `withdrawal` |
| `automation` | `customerRoot`, `supplierRoot`, `payrollRoot` |

---

## STEP 2 — Validate: FAIL LOUDLY on missing rules

```python
from django.core.exceptions import ValidationError

if not account_id:
    raise ValidationError(
        "Cannot post [OPERATION]: '[FRIENDLY_NAME]' account not configured in posting rules. "
        "Go to Finance → Settings → Posting Rules."
    )
```

### Rules for error messages:

1. **Always name the operation** — "Cannot post stock reception", "Cannot post delivery COGS"
2. **Always name the missing rule** — "'Inventory Assets' account not configured"  
3. **Always tell the user where to fix it** — "Go to Finance → Settings → Posting Rules."
4. **Use `ValidationError`** for service-level code  
5. **Use `Response(status=400)`** for ViewSet/API-level code
6. **Use `WorkflowError`** inside `SalesWorkflowService`

---

## STEP 3 — NEVER do these things

### ❌ BANNED PATTERNS — Immediate rejection

```python
# ❌ BANNED: Hardcoded COA code
account = ChartOfAccount.objects.filter(code='411').first()

# ❌ BANNED: Hardcoded fallback
parent_code = '1110' if is_customer else '2101'

# ❌ BANNED: Silent skip on missing config
if not acc_id:
    return None  # ← THIS IS A BUG

# ❌ BANNED: Swallowing errors
try:
    LedgerService.create_journal_entry(...)
except Exception:
    pass  # ← ACCOUNTING CORRUPTION RISK

# ❌ BANNED: Hardcoded dictionaries
_COA = {'AR': '411', 'REVENUE': '701', 'COGS': '601'}

# ❌ BANNED: get_or_create with hardcoded codes
ChartOfAccount.objects.get_or_create(code='5700', defaults={...})
```

### ✅ REQUIRED PATTERNS

```python
# ✅ CORRECT: Dynamic resolution
rules = ConfigurationService.get_posting_rules(organization)
acc_id = rules.get('sales', {}).get('receivable')

# ✅ CORRECT: Explicit error
if not acc_id:
    raise ValidationError("Cannot post: 'Accounts Receivable' not configured in posting rules.")

# ✅ CORRECT: Direct journal entry (no try/except hiding errors)
LedgerService.create_journal_entry(
    organization=org,
    lines=[{"account_id": acc_id, ...}],
    ...
)

# ✅ CORRECT: Fallback CHAIN (not hardcoded code)
acc_id = rules.get('automation', {}).get('customerRoot') or rules.get('sales', {}).get('receivable')
if not acc_id:
    raise ValidationError(...)
```

---

## STEP 4 — Pre-commit checklist

Before submitting any code that touches financial posting:

- [ ] **Zero hardcoded COA codes** — `grep -rn "code='[0-9]" apps/` returns only test files
- [ ] **All accounts from posting rules** — every `account_id` in JE lines comes from `get_posting_rules()`
- [ ] **No silent failures** — no `return None`, `return`, or `pass` after a missing rule check
- [ ] **Error messages are actionable** — user knows WHAT is missing and WHERE to fix it
- [ ] **Frontend form covers all keys** — `posting-rules/form.tsx` exposes every backend key

---

## STEP 5 — Audit existing code (when requested)

// turbo
```bash
# Find any remaining hardcoded COA codes in production files
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
grep -rn "code='[0-9]" apps/ --include="*.py" | grep -v "tests/" | grep -v "__pycache__"
```

// turbo
```bash  
# Find any silent skips after posting rule checks
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
grep -rn "return None" apps/ --include="*.py" -A2 | grep -i "posting\|rule\|coa\|account"
```

---

## Reference: Complete file inventory (all posting paths)

| File | Posting Rules Used | Error Type |
|------|-------------------|------------|
| `accounting_engine.py` | `sales.*`, `purchases.*` | `ValidationError` |
| `invoice_posting_service.py` | `sales.*`, `purchases.*` | `ValidationError` |
| `posting_service.py` | `purchases.payable`, `sales.receivable` | `ValidationError` |
| `pos_service.py` (checkout) | `sales.*`, `purchases.tax` | `ValidationError` |
| `accounting_poster.py` | `sales.*`, `tax.*` via `_resolve_accounts()` | `ValidationError` |
| `workflow_service.py` | `sales.cogs`, `sales.inventory`, `sales.receivable` | `WorkflowError` |
| `reconciliation_service.py` | `sales.round_off`, `sales.receivable` + register config | `ValidationError` |
| `stock_service.py` | `sales.inventory`, `suspense.reception`, `inventory.*` | `ValidationError` |
| `asset_service.py` | User-selected COA IDs on asset/expense objects | `ValidationError` |
| `voucher_service.py` | Linked account IDs from contacts/events | `ValidationError` |
| `ledger_events.py` | `partners.*`, `equity.*` | `ValidationError` |
| `ledger_core.py` | `suspense.reception` | `ValidationError` |
| `payment_service.py` | `purchases.vat_suspense`, `purchases.tax` | `ValidationError` |
| `contact_views.py` | `automation.customerRoot/supplierRoot` | `400 Response` |
| `employee_views.py` | `automation.payrollRoot`, `partners.*`, `equity.*` | `400 Response` |
| `account_views.py` | Type-based dynamic resolution | `400 Response` |
| `register_lobby.py` | `automation.customerRoot` → `sales.receivable` | Service error |
| `migration/services_finance.py` | Root-type COA resolution, `sales.*`, `purchases.*` | Log + skip |
| `migration/views_review.py` | `automation.customerRoot/supplierRoot` | `400 Response` |
| `migration/ledger_integrator.py` | `sales.*` | `ValueError` |
