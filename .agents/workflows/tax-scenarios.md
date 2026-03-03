---
description: How to implement, extend, or debug any tax scenario in TSFSYSTEM
---

# Tax Scenarios Workflow

> Full reference: `DOCUMENTATION/tax_master_documentation.md`

## STEP 1 — Identify the context

1. **OrgTaxPolicy** → `Finance → Settings → Tax Policy` (`POLICY_REAL` / `POLICY_MIXED` / `POLICY_REGULAR` / `POLICY_MICRO`)
2. **Counterparty profile** → `CRM → Contact → Tax Profile` (`vat_registered`, `reverse_charge`, `airsi_subject`)
3. **Scope** → `OFFICIAL` or `INTERNAL`
4. **Destination** → domestic or export?

Scope guard: If `scope != OFFICIAL` → **no VAT lines** are ever posted.

---

## STEP 2 — Verify posting rules are configured

```python
from erp.services import ConfigurationService
rules = ConfigurationService.get_posting_rules(organization)
assert rules["purchases"]["inventory"],        "Missing: purchases.inventory"
assert rules["purchases"]["vat_recoverable"],  "Missing: purchases.vat_recoverable (TVA Récupérable)"
assert rules["sales"]["vat_collected"],        "Missing: sales.vat_collected (TVA Collectée)"
assert rules["tax"]["vat_payable"],            "Missing: tax.vat_payable (VAT netting account)"
assert rules["tax"]["vat_refund_receivable"],  "Missing: tax.vat_refund_receivable"
```

If any are `None` → go to `Finance → Settings → Posting Rules`.

---

## STEP 3 — VAT + AIRSI decision tree

```python
# === SCOPE GUARD ===
vat_active = (scope == "OFFICIAL") and org.tax_policy.vat_registered

# === Purchase VAT cost impact ===
vat_cost_impact = vat_amount * (1 - org.tax_policy.vat_input_recoverability)
inventory_value = ht_amount + vat_cost_impact

# === AIRSI TREATMENT ===
if org.tax_policy.airsi_treatment == 'RECOVER':    → DR AIRSI Récupérable
if org.tax_policy.airsi_treatment == 'CAPITALIZE': → add to inventory cost
if org.tax_policy.airsi_treatment == 'EXPENSE':    → DR AIRSI Expense

# Rule: Never hardcode account names — always use rules['...']['...']
# Key names: purchases.vat_recoverable | sales.vat_collected | tax.vat_payable | tax.vat_refund_receivable
```

---

## STEP 4 — Invoice type at checkout

```python
if scope == "OFFICIAL" and org.tax_policy.vat_registered:
    invoice_type = "TVA_INVOICE" if client.tax_profile.vat_registered else "RECEIPT"
elif scope == "INTERNAL":
    invoice_type = "INTERNAL_RECEIPT"
else:
    invoice_type = "SIMPLE_INVOICE"
```

---

## STEP 5 — Run VAT Settlement preview

// turbo
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
.venv/bin/python3 manage.py shell -c "
from apps.finance.services.vat_settlement_service import VATSettlementService
from erp.models import Organization
from datetime import date
org = Organization.objects.get(slug='YOUR_ORG_SLUG')
print(VATSettlementService.calculate_settlement(org, date(2026,3,1), date(2026,3,31)))
"
```

If `net_due < 0` (state owes us): settlement posts to `VAT Refund Receivable`, not Bank.

---

## STEP 6 — Run tests

// turbo
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
.venv/bin/python3 manage.py test erp.tests.test_mixed_tax_engine --verbosity=2
.venv/bin/python3 manage.py test erp.tests.test_financial_lifecycle --verbosity=2
.venv/bin/python3 manage.py test apps.finance.tests.test_finance_rules --verbosity=2
```

**Current status: 11/11 passing** — covers scope guard, AIRSI CAPITALIZE, REAL VAT recovery, refund receivable, and VAT payable netting.

---

## STEP 7 — Check migrations

// turbo
```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
.venv/bin/python3 manage.py migrate --check
.venv/bin/python3 manage.py showmigrations crm
.venv/bin/python3 manage.py showmigrations pos
.venv/bin/python3 manage.py showmigrations finance
```

---

## STEP 8 — Verify ledger entries after a purchase

```python
from apps.finance.models import JournalEntry
for e in JournalEntry.objects.filter(reference__startswith='ORD-').order_by('-created_at')[:3]:
    print(e.description)
    for line in e.lines.all():
        print(f"  DR {line.debit} | CR {line.credit} → Account {line.account_id}")
```

---

## Scenario quick lookup

| Scenario | File | Method |
|----------|------|--------|
| Purchase — all types | `purchase_service.py` | `quick_purchase()` |
| Checkout + invoice type | `pos_service.py` / `document_resolver.py` | `checkout()` / `resolve_invoice_type()` |
| VAT settlement | `vat_settlement_service.py` | `post_settlement()` |
| AIRSI cost impact | `cost_engine.py` | `resolve_effective_cost()` |
| Periodic tax accrual | `periodic_tax_accrual.py` | `PeriodicTaxAccrual.run()` |
| Sales returns | `returns_service.py` | `approve_sales_return()` |

Full scenario matrix → `DOCUMENTATION/tax_master_documentation.md`
