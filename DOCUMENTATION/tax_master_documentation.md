# 🧾 TSFSYSTEM — Tax Master Documentation & Workflow
**Version:** 2.1 (Production Strategy) | **Date:** 2026-03-03 | **Maintainer:** masterAgent (Antigravity)

> Single source of truth for: tax logic, VAT handling, AIRSI withholding/treatment, accounting entries, settlement workflows, and implementation/debug steps across TSFSYSTEM.

---

## 📖 TABLE OF CONTENTS

1. [OrgTaxPolicy Presets](#1-orgtaxpolicy-presets)
2. [CounterpartyTaxProfile Presets](#2-counterpartytaxprofile-presets)
3. [Scopes](#3-scopes)
4. [Cost Views](#4-cost-views)
5. [Purchase Scenarios](#5-purchase-scenarios)
6. [Sales Scenarios](#6-sales-scenarios)
7. [Document Types](#7-document-types)
8. [VAT Settlement (End of Period)](#8-vat-settlement-end-of-period)
9. [AIRSI Withholding Tax](#9-airsi-withholding-tax)
10. [Periodic Taxes](#10-periodic-taxes)
11. [Special Cases](#11-special-cases)
12. [Backend Architecture](#12-backend-architecture)
13. [API Reference](#13-api-reference)
14. [Configuration Guide](#14-configuration-guide)
15. [Decisions Log](#15-decisions-log)
16. [Implementation Status](#16-implementation-status)
17. [Workflow — Implement, Extend, Debug](#17-workflow--implement-extend-debug)

---

## 1. OrgTaxPolicy Presets

Configured in: `Finance → Settings → Tax Policy`

`OrgTaxPolicy` defines how **your organization** behaves fiscally.

> [!NOTE]
> Commercial category (Retail/Wholesale/Normal/Foreign…) is a **label only**.
> Fiscal behavior comes from `OrgTaxPolicy` + `CounterpartyTaxProfile` + `Scope`.

### OrgTaxPolicy Fields (core)

**VAT**
- `vat_registered` → do you charge VAT on OFFICIAL sales?
- `vat_input_recoverability` → `0.0` → `1.0` (how much input VAT you reclaim on OFFICIAL purchases)

**AIRSI**
- `airsi_treatment` → `CAPITALIZE` | `RECOVER` | `EXPENSE`

**Purchase Tax**
- `purchase_tax_rate`
- `purchase_tax_mode` → `CAPITALIZE` | `EXPENSE`

**Periodic / Sales / Profit**
- `sales_tax_rate`
- `sales_tax_trigger` → `ON_TURNOVER` | `ON_PROFIT`
- `periodic_amount`, `periodic_interval`
- `profit_tax_mode`

**Scope**
- `allowed_scopes` → `["OFFICIAL"]` or `["OFFICIAL", "INTERNAL"]`
- `internal_cost_mode` → `TTC_ALWAYS` | `SAME_AS_OFFICIAL`

### Suggested Presets

> [!IMPORTANT]
> Presets are **data records**. The engine never checks preset names — only fields.

| Preset | Description | VAT output | VAT input recoverability | AIRSI treatment | Scopes |
|--------|-------------|-----------|------------------------|----------------|--------|
| `POLICY_REAL` | Fully VAT-registered, normal accounting | ✅ Yes | 1.0 | RECOVER | OFFICIAL |
| `POLICY_MIXED` | Dual scope: OFFICIAL + INTERNAL | ✅ Yes (official only) | 1.0 (official only) | CAPITALIZE | OFFICIAL+INTERNAL |
| `POLICY_REGULAR` | TTC invoicing model, not ledger-splitting | ❌ No (default) | 0.0 | CAPITALIZE | OFFICIAL |
| `POLICY_MICRO` | No VAT, flat micro regime | ❌ No | 0.0 | EXPENSE | OFFICIAL |

---

## 2. CounterpartyTaxProfile Presets

Configured in: `CRM → Contact → Tax Profile`

`CounterpartyTaxProfile` applies to both **suppliers** and **clients**.

### CounterpartyTaxProfile Fields

**`vat_registered`**
- Supplier meaning: do they charge VAT on their invoice?
- Client meaning: are they VAT-registered (assujetti) and require a VAT invoice?

**`reverse_charge`** (supplier only)
- Foreign supplier scenario → autoliquidation when org VAT is active

**`airsi_subject`** (supplier only)
- Buying from this supplier triggers AIRSI withholding

**`allowed_scopes`**
- Usually `["OFFICIAL"]`; may allow `["OFFICIAL","INTERNAL"]` for internal tracking

### Suggested Presets

| Preset | Typical use | `vat_registered` | `reverse_charge` | `airsi_subject` |
|--------|------------|-----------------|-----------------|----------------|
| `SUPPLIER_ASSUJETTI` | Local VAT supplier | ✅ | ❌ | depends |
| `SUPPLIER_NON_ASSUJETTI` | Informal / not VAT registered | ❌ | ❌ | depends |
| `SUPPLIER_FOREIGN_RC` | Foreign vendor | ❌ | ✅ | ❌ |
| `CLIENT_VAT_REGISTERED` | B2B assujetti | ✅ | ❌ | n/a |
| `CLIENT_NOT_REGISTERED` | B2C / non-assujetti | ❌ | ❌ | n/a |

> [!NOTE]
> Do **not** model "client VAT recoverability". Your obligation is **document correctness** (VAT invoice vs receipt), not their internal reclaim process.

---

## 3. Scopes

Scopes represent **posting reality**:

| Scope | Meaning |
|-------|---------|
| `OFFICIAL` | Declared accounting — VAT applies if org VAT is enabled |
| `INTERNAL` | Management/internal tracking — VAT **never** posted |

**Scope guard (hard rule):**

```
If scope != OFFICIAL → no VAT lines are created, no TVA accounts posted.
```

**INTERNAL scope reporting behaviour:**
- INTERNAL transactions never touch `sales.vat_collected` or `purchases.vat_recoverable` accounts (scope guard upstream).
- They are therefore **automatically excluded** from VAT settlement calculations — no explicit filter needed.
- INTERNAL transactions are also excluded from SalesAuditLog DGI reporting.
- They appear **only** in management reports and internal P&L views.

**Reverse charge** can only run when:
```
scope == OFFICIAL  AND  org.tax_policy.vat_registered == true
```

---

## 4. Cost Views

Three cost views are stored on Order (or derived):

| View | Definition | Used for |
|------|-----------|---------|
| `cost_official` | `base_ht + Σ(tax × cost_impact_ratio) + direct_charges` | Inventory valuation, accounting |
| `cost_internal` | Invoice TTC owed + all taxes owed + charges | Management valuation per invoice date |
| `cost_cash` | Cash actually paid (payment movements only) | Treasury, reconciliation |

> [!NOTE]
> `cost_internal` ≠ `cost_cash` when on credit, partial payment, or delayed payment.

### Pricing Basis Resolution

Suppliers may invoice with HT+VAT or TTC only. The engine resolves both:

```python
# In TaxCalculator / purchase_service — per line:
if unitCostHT is provided:
    ht  = unitCostHT
    vat = ht * taxRate
    ttc = ht + vat
else:  # TTC provided
    ttc = unitCostTTC
    ht  = ttc / (1 + taxRate)
    vat = ttc - ht
```

### Rounding Strategy

> [!IMPORTANT]
> **TSFSYSTEM rounding rule: round per invoice, not per line.**
> Each line computes a raw VAT amount (`ht × rate`). The per-line amounts are **summed**, then the total is rounded to 2 decimal places once.
> This matches DGI reporting expectations and avoids accumulated rounding drift.

### cost_impact_ratio Table

| Tax type / treatment | Ratio | Meaning |
|---------------------|-------|---------|
| VAT (recoverability = 1.0) | 0.0 | Not in cost |
| VAT (recoverability = 0.5) | 0.5 | Partial recovery |
| VAT (recoverability = 0.0) | 1.0 | Fully absorbed into cost |
| Purchase tax CAPITALIZE | 1.0 | Added to cost |
| Purchase tax EXPENSE | 0.0 | P&L only |
| AIRSI CAPITALIZE | 1.0 | Added to cost |
| AIRSI RECOVER | 0.0 | Asset — not in cost |
| AIRSI EXPENSE | 0.0 | P&L only |

---

## 5. Purchase Scenarios

> DR = Debit | CR = Credit | HT = Hors Taxe | TTC = Toutes Taxes Comprises  
> Base example: HT 1,000 | VAT 18% (180) | TTC 1,180 | AIRSI 5% on HT = 50

### Purchase Engine Logic

```
1. VAT scope guard (runs first):
   vat_active = (scope == "OFFICIAL") AND org.vat_registered

2. If NOT vat_active → no VAT posting at all.
3. If supplier.reverse_charge AND vat_active → post both sides (net 0).
4. VAT cost impact = vat_amount × (1 - vat_input_recoverability)
5. AIRSI treatment → CAPITALIZE / RECOVER / EXPENSE per OrgTaxPolicy
```

---

#### P-1 | OFFICIAL + org VAT active + supplier charges VAT + recoverability = 1.0
```
DR Inventory                  1,000
DR TVA Récupérable              180
  CR Accounts Payable         1,180
```

#### P-2 | OFFICIAL + org VAT active + supplier charges VAT + recoverability = 0.0
```
DR Inventory                  1,180   ← full TTC absorbed
  CR Accounts Payable         1,180
```

#### P-3 | OFFICIAL + org VAT active + supplier charges VAT + recoverability = 0.5
```
DR Inventory                  1,090   ← HT + 50% of VAT
DR TVA Récupérable               90   ← 50% of VAT recovered
  CR Accounts Payable         1,180
```

#### P-4 | OFFICIAL + supplier NOT vat_registered
```
DR Inventory                  1,000   ← no VAT on their invoice
  CR Accounts Payable         1,000
```

#### P-5 | OFFICIAL + reverse charge supplier + org VAT active
```
DR Inventory                  1,000
DR TVA Récupérable              180   ← self-assessed recovery
  CR TVA Auto-liquidée          180   ← self-assessed liability (net = 0)
  CR Accounts Payable         1,000   ← only HT owed to foreign supplier
```

#### P-6 | OFFICIAL + AIRSI subject + airsi_treatment = CAPITALIZE + AIRSI Payable configured
```
DR Inventory                  1,050   ← HT + AIRSI capitalized
DR TVA Récupérable              180
  CR Accounts Payable         1,180   ← TTC - AIRSI (AP net of withholding)
  CR AIRSI Payable               50
```

#### P-6b | OFFICIAL + AIRSI subject + airsi_treatment = CAPITALIZE, **no AIRSI Payable account set**
```
DR Inventory                  1,230   ← HT + VAT (non-recov.) + AIRSI
  CR Accounts Payable         1,230   ← full invoice (AP not netted; no separate payable)
```

> [!NOTE]
> AIRSI netting from AP only happens when an `airsi_payable` account is configured.
> Without it, AP carries the full invoice and AIRSI is purely absorbed into cost.

#### P-7 | OFFICIAL + AIRSI subject + airsi_treatment = RECOVER
```
DR Inventory                  1,000
DR TVA Récupérable              180
DR AIRSI Récupérable             50   ← asset, offsets corporate tax debt
  CR Accounts Payable         1,180
  CR AIRSI Payable               50
```

#### P-8 | OFFICIAL + AIRSI subject + airsi_treatment = EXPENSE
```
DR Inventory                  1,180   ← depends on VAT recoverability
DR AIRSI Expense                 50   ← hits P&L
  CR Accounts Payable         1,180
  CR AIRSI Payable               50
```

#### P-9 | INTERNAL scope (VAT guard blocks all VAT posting)
```
Default internal_cost_mode = TTC_ALWAYS:

DR Inventory                  1,180   ← full TTC is cost
  CR Accounts Payable         1,180
(all lines: scope=INTERNAL)
```

---

## 6. Sales Scenarios

> Sale example: HT 1,000 | VAT 180 | TTC 1,180 | COGS 600

### Sales Engine Logic

```
vat_active = (scope == "OFFICIAL") AND org.vat_registered
Document type depends on client.tax_profile.vat_registered when vat_active.
```

---

#### S-1 | OFFICIAL + org VAT active + client vat_registered = true → TVA invoice
```
DR Accounts Receivable        1,180
  CR Revenue HT               1,000
  CR TVA Collectée              180
DR COGS                         600
  CR Inventory                  600
```

#### S-2 | OFFICIAL + org VAT active + client vat_registered = false → Receipt
```
(Receipt shows TTC only, but internal ledger still splits HT + VAT)

DR Cash                       1,180
  CR Revenue HT               1,000
  CR TVA Collectée              180
DR COGS                         600
  CR Inventory                  600
```

#### S-3 | OFFICIAL + org NOT VAT registered → Simple invoice
```
DR Cash                       1,000
  CR Revenue                  1,000
DR COGS                         600
  CR Inventory                  600
```

#### S-4 | INTERNAL scope → Internal receipt
```
DR Cash                       1,000
  CR Revenue                  1,000   (scope=INTERNAL)
DR COGS                         600
  CR Inventory                  600
```

#### S-5 | Export sale (VAT = 0%)
```
Export identified by: destination_country ≠ org_country OR explicit export flag.

DR Accounts Receivable        1,000
  CR Revenue HT               1,000
DR COGS                         600
  CR Inventory                  600
```

---

## 7. Document Types

Document type is **derived at checkout** from policy + counterparty + scope:

| Conditions | `invoice_type` |
|-----------|---------------|
| OFFICIAL + org VAT active + client vat_registered | `TVA_INVOICE` |
| OFFICIAL + org VAT active + client NOT vat_registered | `RECEIPT` |
| OFFICIAL + org NOT VAT registered | `SIMPLE_INVOICE` |
| INTERNAL | `INTERNAL_RECEIPT` |

```python
if scope == "OFFICIAL" and org.tax_policy.vat_registered:
    invoice_type = "TVA_INVOICE" if client.tax_profile.vat_registered else "RECEIPT"
elif scope == "INTERNAL":
    invoice_type = "INTERNAL_RECEIPT"
else:
    invoice_type = "SIMPLE_INVOICE"
```

---

## 8. VAT Settlement (End of Period)

VAT **never flows out per transaction** — it accumulates and is settled periodically.

```
Net VAT Due = TVA Collectée − TVA Récupérable
```

### 2-Step Settlement (V2.2 production approach)

**Step 1 — Netting entry** (posted by `VATSettlementService.post_settlement`):

```
-- net_due > 0 (we owe DGI) --
DR TVA Collectée          XXX   ← clear liability
  CR TVA Récupérable      XXX   ← clear asset
  CR VAT Payable           XXX   ← control account (DGI liability)

-- net_due < 0 (DGI owes us a refund) --
DR TVA Collectée          XXX
DR VAT Refund Receivable  XXX   ← asset — DGI owes us
  CR TVA Récupérable      XXX
```

**Step 2 — Cash movement** (manual journal posted by accountant):

```
-- Payment to DGI --
DR VAT Payable
  CR Bank

-- DGI refund received --
DR Bank
  CR VAT Refund Receivable
```

> [!NOTE]
> `post_settlement` posts Step 1 only. Step 2 is a manual journal when cash actually moves.
> INTERNAL-scope transactions never touch TVA accounts (scope guard), so they are implicitly excluded.

### API
```python
VATSettlementService.calculate_settlement(org, period_start, period_end)
# → { vat_collected, vat_recoverable, net_due }

VATSettlementService.post_settlement(org, period_start, period_end)
# → { journal_entry_id, report, next_step }
```
Endpoint: `POST /api/journal/vat_settlement/`

---

## 9. AIRSI Withholding Tax

AIRSI is withheld from supplier payment and remitted to DGI on the supplier's behalf.

**Trigger conditions:**
- `global_airsi_rate > 0` (configured in global settings)
- `supplier.tax_profile.airsi_subject = True`
- Rate: `supplier.airsi_tax_rate` if set, else global rate

**Treatment — controlled by `org.tax_policy.airsi_treatment`:**

| Treatment | Ledger posting | Effect |
|-----------|---------------|--------|
| `RECOVER` | DR AIRSI Récupérable (asset) | Offsets corporate tax debt |
| `CAPITALIZE` | Inventory cost += AIRSI | Absorbed into stock cost |
| `EXPENSE` | DR AIRSI Expense | Hits P&L directly |

> [!IMPORTANT]
> AIRSI Payable is **always** tracked as a liability until remitted to DGI, regardless of org treatment.  
> AP netting (AP = TTC − AIRSI) only applies when `purchases.airsi_payable` is configured.  
> Without it, AP = full invoice and AIRSI is absorbed purely in cost.

### AIRSI Remittance

When the company remits the withheld AIRSI to DGI:

```
DR AIRSI Payable    (amount withheld in period)
  CR Bank           (cash paid to DGI)
```

```python
from apps.finance.services import AIRSIRemittanceService

# Preview:
AIRSIRemittanceService.calculate_airsi_payable(org, period_start, period_end)
# → { airsi_withheld, airsi_paid, airsi_net_payable }

# Post:
AIRSIRemittanceService.post_remittance(org, period_start, period_end, bank_account_id)
# Optional: amount= for partial remittances
```
Endpoint: `POST /api/journal/airsi_remittance/`

---

## 10. Periodic Taxes

Turnover tax, forfait, minimum legal, and profit tax provisioning are **not per-line taxes**. They are posted by a period-close service:

```python
PeriodicTaxAccrual.run(org, period_start, period_end)
# Reads org.tax_policy.sales_tax_trigger
# base = revenue (ON_TURNOVER) or profit (ON_PROFIT)
# Posts:
DR Tax Expense
  CR Tax Payable
```

---

## 11. Special Cases

### Partial payment (purchase on credit)
```
Invoice posting:  DR Inventory/Tax | CR AP
Payment posting:  DR AP | CR Bank  (one or many partial payments)
```

### Discount on purchase
Apply discount to **HT base** before computing VAT and AIRSI:
```
DR Inventory     (HT net)
DR TVA Réc.      (VAT on net HT)
  CR AP          (TTC net)
  CR Discount Earned
```

### Returns / Credit notes
```
Return reverses original entries + restocks inventory.
Credit note links to original order for full audit trail.
```

### HT ↔ TTC Conversion
```
TTC → HT:  HT  = TTC / (1 + rate)
HT  → TTC: TTC = HT  × (1 + rate)
VAT from TTC: VAT = TTC × rate / (1 + rate)
```

---

## 12. Backend Architecture

```
erp_backend/apps/finance/
├── tax_engine/
│   ├── tax_calculator.py               ← Line tax computation (transactional)
│   ├── cost_engine.py                  ← cost_official / internal / cash rules
│   ├── document_resolver.py            ← invoice_type decision
│   ├── vat_settlement_service.py       ← End-of-period settlement (2-step)
│   ├── airsi_remittance_service.py     ← AIRSI Payable settlement to DGI
│   └── periodic_tax_accrual.py         ← Turnover / profit / forfait accrual
│
├── models/
│   ├── org_tax_policy.py               ← OrgTaxPolicy
│   ├── counterparty_tax_profile.py     ← CounterpartyTaxProfile
│   ├── order_line_tax_entry.py         ← Transactional tax lines per order line
│   └── periodic_tax_accrual.py         ← Posted accrual records
│
apps/crm/
└── models/contact_models.py            ← Contact.tax_profile_id + commercial_category

apps/pos/
├── services/pos_service.py             ← checkout() — document_resolver + tax_engine
└── models/pos_models.py                ← Order.invoice_type + cost views
```

### Document Lifecycle & Posting Moments

| Document | Draft | Journal posted at | Cancellation |
|----------|-------|------------------|--------------|
| Purchase order | At creation | Invoice validation (`quick_purchase`) | Reversal JE |
| Sales order | At creation | Checkout / invoice issuance (`checkout`) | Credit note + reversal JE |
| Payment | N/A | Cash movement (DR AP / CR Bank) | Contra entry |
| VAT settlement | N/A | Period close (`post_settlement`, Step 1) | Manual adjustment |
| VAT payment | N/A | When DGI paid (Step 2, manual) | N/A |
| AIRSI remittance | N/A | When DGI paid (`post_remittance`) | N/A |

> [!NOTE]
> Period locks (`FiscalPeriod.is_closed`) prevent new postings to closed periods.
> Cancellations must be posted in the **current open period**, not backdated.

---

## 13. API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/tax-policies/` | OrgTaxPolicy CRUD |
| GET/POST | `/api/tax-profiles/` | CounterpartyTaxProfile CRUD |
| GET | `/api/tax-reports/vat/` | VAT declaration report |
| POST | `/api/journal/vat_settlement/` | Post VAT settlement (Step 1 netting) |
| POST | `/api/journal/airsi_remittance/` | Post AIRSI remittance to DGI |
| POST | `/api/period/periodic_tax_accrual/` | Run PeriodicTaxAccrual |
| POST | `/api/purchases/quick/` | Quick purchase (full tax engine) |
| POST | `/api/pos/checkout/` | Checkout — `invoice_type` + VAT logic |
| POST | `/api/sales-returns/{id}/approve/` | Approve return + restock + credit note |

---

## 14. Configuration Guide

### Posting Rules (`Finance → Settings → Posting Rules`)

| Rule key | Account type | Used for |
|----------|-------------|---------|
| `purchases.payable` | Liability | Accounts Payable |
| `purchases.inventory` | Asset | Inventory valuation |
| `purchases.vat_recoverable` | Asset 1xxx | TVA Récupérable (input VAT) |
| `purchases.airsi_payable` | Liability | AIRSI Payable to DGI |
| `purchases.airsi` | Asset/Expense | AIRSI Récupérable or Expense (per treatment) |
| `purchases.reverse_charge_vat` | Liability | Reverse Charge — auto-liquidation output |
| `purchases.discount_earned` | Income | Purchase Discount Earned |
| `purchases.delivery_fees` | Asset/Expense | Delivery fees (extra fees) |
| `sales.vat_collected` | Liability 4xxx | TVA Collectée |
| `sales.revenue` | Income 7xxx | Revenue HT |
| `sales.receivable` | Asset 4xxx | Accounts Receivable |
| `sales.cogs` | Expense | Cost of Goods Sold |
| `tax.vat_payable` | Liability | VAT Payable to DGI (netting control account) |
| `tax.vat_refund_receivable` | Asset | VAT Refund Receivable (when DGI owes us) |

### Required Accounts per Feature

| Feature | Required posting rule keys |
|---------|---------------------------|
| VAT settlement | `sales.vat_collected`, `purchases.vat_recoverable`, `tax.vat_payable` |
| VAT refund | `sales.vat_collected`, `purchases.vat_recoverable`, `tax.vat_refund_receivable` |
| Reverse charge | `purchases.vat_recoverable`, `purchases.reverse_charge_vat` |
| AIRSI withholding | `purchases.airsi_payable` (+ `purchases.airsi` for RECOVER) |
| AIRSI remittance | `purchases.airsi_payable` + bank account |

### Global Settings (`Finance → Settings`)

| Key | Values | Effect |
|-----|--------|--------|
| `global_airsi_rate` | Decimal (e.g. `5`) | AIRSI withholding rate |
| `default_scope` | `OFFICIAL` / `INTERNAL` | Default scope for new documents |
| `declare_vat` | Boolean | Whether VAT reports/settlement is used |

---

## 15. Decisions Log

| # | Decision | Status |
|---|---------|--------|
| D1 | Replace `companyType` with `OrgTaxPolicy` | ✅ Approved |
| D2 | Replace `supplier_vat_regime` / `client_type` with `CounterpartyTaxProfile` | ✅ Approved |
| D3 | VAT never posted in INTERNAL scope (hard guard) | ✅ Approved |
| D4 | VAT refunds use `VAT Refund Receivable`, not Bank directly | ✅ Approved |
| D5 | Periodic taxes posted by `PeriodicTaxAccrual` service | ✅ Approved |
| D6 | Export VAT = 0% using `destination_country` / export flag | ✅ Approved |
| D7 | AIRSI AP netting only when `airsi_payable` account configured; otherwise AP = full invoice | ✅ Approved |
| D8 | VAT settlement is 2-step: netting to `tax.vat_payable`, cash movement is Step 2 (manual) | ✅ Approved |
| D9 | Posting rule keys standardized: `purchases.vat_recoverable`, `sales.vat_collected`, `tax.vat_payable`, `tax.vat_refund_receivable` | ✅ Approved |
| D10 | Rounding: per-invoice (sum raw line amounts, round once to 2dp) | ✅ Approved |

---

## 16. Implementation Status

| Feature | Status |
|---------|--------|
| `OrgTaxPolicy` model + UI | ✅ Complete |
| `CounterpartyTaxProfile` model + UI | ✅ Complete |
| Migrations from legacy fields | ✅ Complete |
| `OrderLineTaxEntry` model | ✅ Complete |
| Scope guard at engine top | ✅ Complete |
| `invoice_type` resolver at checkout | ✅ Complete |
| `VATSettlementService` 2-step netting | ✅ Complete |
| `AIRSIRemittanceService` | ✅ Complete |
| `PeriodicTaxAccrual` service | ✅ Complete |
| Export VAT 0% logic | ✅ Complete |
| AIRSI AP credit 3-branch posting logic | ✅ Complete |
| Posting rule keys standardized (V2.2) | ✅ Complete |
| HT/TTC basis resolution documented | ✅ Complete |
| Document lifecycle table | ✅ Complete |

---

## 17. Workflow — Implement, Extend, Debug

### STEP 1 — Identify the context

Before touching code, determine:
1. **OrgTaxPolicy** → `Finance → Settings → Tax Policy`
2. **Supplier/Client `tax_profile`** → `CRM → Contact → Tax Profile`
3. **Scope** → `OFFICIAL` or `INTERNAL`
4. **Destination country** → export? (VAT = 0%)

---

### STEP 2 — Verify posting rules are configured

```python
from erp.services import ConfigurationService
rules = ConfigurationService.get_posting_rules(organization)

assert rules["purchases"]["inventory"],       "Missing: purchases.inventory"
assert rules["purchases"]["vat_recoverable"], "Missing: purchases.vat_recoverable"
assert rules["sales"]["vat_collected"],       "Missing: sales.vat_collected"
assert rules["tax"]["refund_receivable"],     "Missing: tax.refund_receivable"
```

---

### STEP 3 — Debug a purchase journal entry

Expected for OFFICIAL + VAT active + recoverability = 1.0:
```
DR Inventory          (HT amount)
DR TVA Récupérable    (VAT × recoverability)
CR AP                 (TTC total)
```

If AIRSI applies:
```
DR AIRSI Récupérable / Inventory / AIRSI Expense   (per treatment)
CR AIRSI Payable
```

---

### STEP 4 — Run VAT Settlement preview

```python
from apps.finance.services.vat_settlement_service import VATSettlementService
from erp.models import Organization
from datetime import date

org = Organization.objects.get(slug='YOUR_ORG_SLUG')
result = VATSettlementService.calculate_settlement(org, date(2026,3,1), date(2026,3,31))
print(result)
# → { vat_collected, vat_recoverable, net_due }
```

---

### STEP 5 — Run tests

```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
.venv/bin/python3 manage.py test erp.tests.test_mixed_tax_engine --verbosity=2
.venv/bin/python3 manage.py test erp.tests.test_financial_lifecycle --verbosity=2
.venv/bin/python3 manage.py test apps.finance.tests.test_finance_rules --verbosity=2
```

**Tests currently passing (10/10):**

| Test | Covers |
|------|--------|
| `test_mixed_mode_purchase_posting` | MIXED company — TTC inventory cost, no ledger VAT |
| `test_mixed_mode_with_airsi` | AIRSI CAPITALIZE — inventory = TTC+AIRSI, AP = full invoice |
| `test_internal_scope_no_vat_posting` | Scope guard — INTERNAL scope never posts VAT |
| `test_real_vat_recovery_purchase` | REAL company — DR Inventory HT + DR TVA Rec. + CR AP TTC |
| `test_vat_settlement_refund_receivable` | Refund settlement — DR VAT Refund Receivable, not Bank |
| `test_closure_validation_*` | Fiscal period closure rules |
| `test_manual_posting_to_system_account_fails` | System-account protection |
| `test_tax_report_generation` | VAT declaration report |

---

### STEP 6 — Check migration state

```bash
cd /root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend
python manage.py migrate --check
python manage.py showmigrations crm
python manage.py showmigrations pos
python manage.py showmigrations finance
```

---

### Scenario Quick Lookup

| Scenario | File | Method |
|----------|------|--------|
| Purchase — all scenarios | `purchase_service.py` | `quick_purchase()` |
| Sales checkout + invoice type | `pos_service.py` | `checkout()` |
| Invoice type resolver | `document_resolver.py` | `resolve_invoice_type()` |
| VAT period-end settlement | `vat_settlement_service.py` | `post_settlement()` |
| AIRSI cost impact | `cost_engine.py` | `resolve_effective_cost()` |
| Tax declaration report | `tax_service.py` | `get_declared_report()` |
| Periodic tax accrual | `periodic_tax_accrual.py` | `PeriodicTaxAccrual.run()` |
| Sales returns / credit notes | `returns_service.py` | `approve_sales_return()` |
