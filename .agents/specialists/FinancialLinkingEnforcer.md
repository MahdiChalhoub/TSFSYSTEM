---
name: Financial Linking Enforcer
description: A strict enforcer that prevents creation of unlinked financial entities and ensures all COA references use dynamic posting rules — never hardcoded codes.
---

# Financial Linking Enforcer

You MUST apply this skill whenever dealing with:
- Financial data importation or creation of new financial accounts
- Any code that creates journal entries or ledger postings
- Any code that references Chart of Account (COA) codes
- Any stock, asset, or payment operation that touches the General Ledger

## The Problem
1. **Orphan Accounts**: Creating financial accounts without linking to the Chart of Accounts causes "Missing Ledger Link!" warnings and breaks accounting.
2. **Hardcoded COA Codes**: Using hardcoded codes like `'411'`, `'701'`, `'1110'` makes the system rigid and breaks when organizations use different chart templates (PCG, IFRS, OHADA variants).
3. **Silent Failures**: Skipping journal entries when posting rules are missing causes invisible accounting corruption — debits ≠ credits, trial balance drift.

## IRON RULES

### Rule 1: No financial account without a COA link
- Every `FinancialAccount.create()` must have `ledger_account` set
- Every CRM `Contact` with auto-ledger integration must resolve its parent from posting rules
- If COA resolution fails → **ABORT** and return an explicit error

### Rule 2: No hardcoded COA codes — EVER
```python
# ❌ BANNED
ChartOfAccount.objects.filter(code='411')
_COA = {'AR': '411', 'REVENUE': '701'}
fallback_code = '1110'

# ✅ REQUIRED
rules = ConfigurationService.get_posting_rules(organization)
acc_id = rules.get('sales', {}).get('receivable')
```

### Rule 3: No silent failures — ALWAYS fail loudly
```python
# ❌ BANNED
if not acc_id:
    return None      # silent corruption
    
if not acc_id:
    pass             # pretending nothing happened

try:
    create_journal_entry(...)
except:
    pass             # swallowing accounting errors

# ✅ REQUIRED
if not acc_id:
    raise ValidationError(
        "Cannot post [OPERATION]: '[ACCOUNT_NAME]' not configured in posting rules. "
        "Go to Finance → Settings → Posting Rules."
    )
```

### Rule 4: Always use ConfigurationService.get_posting_rules()
```python
from erp.services import ConfigurationService
rules = ConfigurationService.get_posting_rules(organization)
```

## Required Steps for Any Financial Code Change

1. **Check**: Does this code create a JournalEntry, FinancialAccount, or reference a COA ID?
2. **Resolve**: All COA IDs must come from `ConfigurationService.get_posting_rules(organization)`
3. **Validate**: If any required posting rule is `None`, raise `ValidationError` with an actionable message
4. **Verify**: Run `grep -rn "code='[0-9]" apps/ --include="*.py" | grep -v tests/` — must return zero results
5. **Test**: Ensure the "missing posting rule" error path is covered

## Workflow Reference
See `/posting-rules-enforcement` workflow for the complete checklist with all posting rule keys and the full file inventory.

Failure to follow these rules leads to broken ledgers, trial balance drift, and accounting data corruption. **Enforce strictly.**
