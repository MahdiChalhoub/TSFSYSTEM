# Accounting Setup Hub — Redesign Plan

> **Module**: Finance Settings
> **Route**: `/finance/settings` (replaces existing 783-line legacy form)
> **Date**: 2026-04-14

---

## Problem Statement

The current `/finance/settings` page is a **legacy 783-line monolith** built around the old `companyType` system (REGULAR/MICRO/REAL/MIXED/CUSTOM). This was superseded by the **Universal Tax Engine** which uses:
- `OrgTaxPolicy` — configurable per-organization tax behavior
- `CounterpartyTaxProfile` — per-client/supplier fiscal identity

The old Company Type selector is dead weight — its auto-config flags (`worksInTTC`, `declareTVA`, `dualView`) are all modeled properly in `OrgTaxPolicy`. However, **11+ backend files** still read `companyType` from `settings.global_financial_settings` as a fallback, meaning we can't just delete it.

Meanwhile, the 4 pillars of accounting setup exist as **scattered, disconnected pages**:
1. Tax Engine Profile → `/finance/tax-policy` (389 lines)
2. COA Template → `/finance/setup` (COA Setup Wizard, 460 lines)
3. Posting Rules → `/finance/settings/posting-rules` (306 lines)
4. Fiscal Year → `/finance/fiscal-years` (94 lines + wizard + cards)

**There is no single "Accounting Setup Hub"** that guides an accountant through the correct sequence.

---

## User Review Required

> [!IMPORTANT]
> **Legacy `companyType` Backend Usage**: 11+ backend files still fallback to `settings.companyType`. We have two options:
> 1. **Keep `companyType` invisible** — automatically derive it from the `OrgTaxPolicy` when saving (e.g., if VAT output=ON + recoverability=1.0 → REAL). No UI exposure.
> 2. **Remove `companyType` entirely** — refactor all 11 backend files to read from `OrgTaxPolicy` directly. This is the clean approach but touches POS, Finance, and Payment services.
>
> **Recommendation**: Option 1 (auto-derive) for now, add cleanup to backlog. Less risky.

> [!WARNING]
> **The old `/finance/settings/form.tsx` (783 lines) will be archived to `/ARCHIVE`**, not deleted. The new hub replaces it entirely.

---

## Proposed Changes

### Architecture: Unified Setup Hub

The new page at `/finance/settings` becomes a **4-step dashboard** with:
- Status indicators (✅ Configured / ⚠️ Pending / ⭕ Not Started)
- Direct inline actions or navigation links
- A logical flow: Tax Profile → COA → Posting Rules → Fiscal Year

```
┌──────────────────────────────────────────────────────┐
│  ⚙️  ACCOUNTING SETUP HUB                           │
│  Configure your organization's financial foundation  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─── STEP 1 ───┐  ┌─── STEP 2 ───┐                │
│  │ 🏛️ Tax Engine │  │ 📊 Chart of  │                │
│  │   Profile     │  │   Accounts   │                │
│  │  ✅ Active    │  │  ✅ IFRS     │                │
│  │  [Configure]  │  │  [Manage]    │                │
│  └──────────────┘  └──────────────┘                │
│                                                      │
│  ┌─── STEP 3 ───┐  ┌─── STEP 4 ───┐                │
│  │ 🎯 Posting   │  │ 📅 Fiscal    │                │
│  │   Rules      │  │   Year       │                │
│  │  ⚠️ 3/48     │  │  ✅ FY 2026  │                │
│  │  [Configure]  │  │  [Manage]    │                │
│  └──────────────┘  └──────────────┘                │
│                                                      │
│ ─────────────── General Settings ───────────────── │
│  Currency: [XOF ▼]   Default TVA: [18% ]           │
│  Payment Methods: [Configure →]                      │
│                                                      │
│ ─────────────── Maintenance Zone ────────────────── │
│  [Recalculate Balances]  [Seed Data]  [Fresh Ver.]  │
└──────────────────────────────────────────────────────┘
```

---

### Component: Frontend

#### [MODIFY] [page.tsx](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/finance/settings/page.tsx)
- Fetch aggregated setup status (tax policy, COA count, posting rules, fiscal year)
- Pass all data to the new `AccountingSetupHub` client component

#### [NEW] `AccountingSetupHub.tsx`
New client component replacing `form.tsx`. Contains:

**Section 1 — Setup Progress Header**
- V2 icon-box header with `Settings2` icon
- Overall readiness score (e.g., "3/4 steps complete")
- Visual progress bar

**Section 2 — 4 Setup Step Cards** (2x2 grid)

| Card | Data Source | Status Logic | Action |
|------|-----------|-------------|--------|
| **Tax Engine Profile** | `getOrgTaxPolicy()` | ✅ if policy exists with `is_default=true` | Navigate to `/finance/tax-policy` |
| **Chart of Accounts** | `getCOASetupStatus()` + account count | ✅ if status=COMPLETED or accounts > 0 | Navigate to `/finance/setup` or `/finance/chart-of-accounts` |
| **Posting Rules** | `getPostingRules()` | ✅ if ≥ 5 rules mapped, ⚠️ if partial, ⭕ if empty | Navigate to `/finance/settings/posting-rules` |
| **Fiscal Year** | `getLatestFiscalYear()` | ✅ if open FY exists, ⚠️ if all closed | Navigate to `/finance/fiscal-years` |

Each card shows:
- Icon + title + subtitle
- Status badge (color-coded)
- Key stats (e.g., "IFRS template · 142 accounts", "FY 2026 · 12 periods · OPEN")
- Action button (Configure / Manage / View)

**Section 3 — General Settings** (inline editable)
- Default Currency selector
- Default TVA Rate input
- Payment Methods link → `/finance/settings/payment-methods`
- Document Sequences link → `/settings/sequences`

**Section 4 — Maintenance Zone** (preserved from old form)
- Recalculate Ledger Balances
- Seed Test Data
- Fresh Version (wipe)

#### [ARCHIVE] [form.tsx](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/(privileged)/finance/settings/form.tsx)
- Move to `/ARCHIVE/finance/settings/form.tsx`
- 783 lines of legacy Company Type UI → archived

---

### Component: Server Actions

#### [MODIFY] [settings.ts](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/actions/finance/settings.ts)
- Remove `companyType` from the `FinancialSettingsState` type
- Add new `getAccountingSetupStatus()` action that aggregates:
  - Tax policy status (from `getOrgTaxPolicy()`)
  - COA status (from `getCOASetupStatus()`)
  - Posting rules fill rate (from `getPostingRules()`)
  - Fiscal year status (from `getLatestFiscalYear()`)
- Keep `currency` and `defaultTaxRate` as saveable fields
- Auto-derive `companyType` from OrgTaxPolicy when saving (backward compat)

---

### Component: Backend (Minimal Changes)

#### [MODIFY] `erp/services.py` — `ConfigurationService.save_global_settings()`
- When saving settings, if `companyType` is not provided, auto-derive it from `OrgTaxPolicy`:
  - `vat_output_enabled=True + vat_input_recoverability=1.0` → `REAL`
  - `vat_output_enabled=False` → `REGULAR`
  - `has dual scope config` → `MIXED`
  - `flat_rate tax` → `MICRO`
- This keeps all 11 legacy fallback paths working without touching them

---

## Open Questions

> [!IMPORTANT]
> 1. **Should the General Settings (currency, TVA rate) be editable inline on the hub, or should they link to a sub-page?** Recommendation: inline, since they're just 2 fields.
> 2. **Should we keep the Maintenance Zone (wipe, seed, recalculate) on this page or move it to a separate `/finance/settings/maintenance` page?** Recommendation: keep it — admins expect it here.
> 3. **Do you want a "First-Time Setup Wizard" mode** that walks new orgs through steps 1-4 sequentially, or is the dashboard-style hub sufficient?

---

## Verification Plan

### Visual Verification
- Open `/finance/settings` in the browser
- Confirm 4 setup cards render with correct statuses
- Confirm navigation to each sub-page works
- Confirm General Settings save correctly

### Functional Verification
- Save currency + TVA rate → verify backend stores correctly
- Verify `companyType` is auto-derived when OrgTaxPolicy exists
- Verify old form is archived (not importable)

### Regression
- POS checkout still reads `companyType` fallback correctly
- Tax calculator still resolves tax behavior
- Payment service still handles VAT posting
