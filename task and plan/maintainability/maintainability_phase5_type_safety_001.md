# Maintainability Phase 5 — Frontend Type Safety (`src/types/erp.ts` starter)

**Status**: IN PROGRESS  
**Priority**: HIGH  
**Created**: 2026-04-30  
**Estimated effort**: ~1 hour for the starter pass on `src/types/erp.ts`  
**Risk**: LOW (type tightening only, no runtime change). Some downstream consumer fixes may be needed.

---

## MANDATORY — Read First

Before starting, the executing agent MUST read:
1. `.agent/BOOTSTRAP.md`
2. `.agent/WORKMAP.md` (Phase 5 entry)
3. `task and plan/maintainability/maintainability_phase1_backend_splits_001.md` (style template)
4. `src/types/erp.ts` — read it in full (it's the target)

---

## Goal

Replace every `any` in `src/types/erp.ts` with a proper type. **Zero runtime change. Zero `// @ts-ignore` / `// @ts-expect-error`. `npx tsc --noEmit` must stay clean (exit 0).**

This is the *starter* pass for the wider Phase 5 sweep. The shared types module is the highest-leverage file because every consumer page widens its own `any` surface from these declarations.

---

## Scope (bounded)

**In-scope:**
- Every `any` in `src/types/erp.ts`.
- Any consumer file from the 95 importers of `@/types/erp` whose compilation breaks once a load-bearing `any` is narrowed. Fixed minimally — no refactor.

**Out-of-scope:**
- The other 2,718 `any` usages elsewhere in `src/`. They get their own follow-up Phase 5 batches (see _Per-file hotspots_ below — those are the next 20 targets).
- Phases 3, 4, 6 work. Don't touch finance/sales/inventory/pos modules unless they import from `@/types/erp` and break.
- New runtime validation libraries (e.g., zod) — not in deps for this pass, do not add.

---

## Discovery numbers (captured 2026-04-30)

### Total `any` usage in frontend

```bash
$ grep -rn ": any\b\|<any>\| any\[\]\|as any" src --include="*.ts" --include="*.tsx" | wc -l
2812
```

(WORKMAP entry quoted "2,527" — fresh count is 2,812. The number drifts as the codebase changes; we use the fresh count as our baseline.)

### Per-file hotspots — top 20

| Rank | Count | File |
|----:|----:|---|
| 1 | 94 | `src/types/erp.ts` ← **this pass** |
| 2 | 50 | `src/app/(privileged)/inventory/packages/PackagesClient.tsx` |
| 3 | 44 | `src/app/(privileged)/inventory/attributes/AttributesClient.tsx` |
| 4 | 32 | `src/components/pos/layouts/POSLayoutModern.tsx` |
| 5 | 32 | `src/app/(privileged)/inventory/units/UnitsClient.tsx` |
| 6 | 28 | `src/app/(privileged)/inventory/categories/components/tabs/ProductsTab.tsx` |
| 7 | 25 | `src/app/(privileged)/workspace/auto-task-rules/page.tsx` |
| 8 | 25 | `src/app/(privileged)/inventory/categories/CategoriesClient.tsx` |
| 9 | 23 | `src/components/templates/EntityProductsTab.tsx` |
| 10 | 22 | `src/components/pos/layouts/_archive/POSLayoutIntelligence.tsx` |
| 11 | 22 | `src/app/(privileged)/inventory/units/mobile/MobileUnitsClient.tsx` |
| 12 | 20 | `src/app/(privileged)/inventory/countries/CountriesClient.tsx` |
| 13 | 19 | `src/components/templates/TreeMasterPage.tsx` |
| 14 | 19 | `src/app/(privileged)/settings/regional/client.tsx` |
| 15 | 19 | `src/app/(privileged)/inventory/categories/mobile/MobileCategoriesClient.tsx` |
| 16 | 19 | `src/app/(privileged)/inventory/categories/components/tabs/AttributesTab.tsx` |
| 17 | 19 | `src/app/(privileged)/inventory/brands/mobile/MobileBrandsClient.tsx` |
| 18 | 19 | `src/app/(privileged)/finance/reports/balance-sheet/viewer.tsx` |
| 19 | 19 | `src/app/actions/setup-wizard.ts` |
| 20 | 18 | `src/hooks/pos/usePOSTerminal.ts` |

These 20 files alone account for ~595 `any`s (≈21% of the total). After `erp.ts`, the next obvious batches are the 8 inventory/admin UI clients (top of the list).

---

## Strategy

The 94 `any`s in `erp.ts` fall into four categories. Each gets a uniform replacement rule:

### Rule 1 — `[key: string]: any` index signatures on entity interfaces

These exist on most entity interfaces (`JournalEntry`, `Voucher`, `Product`, `PurchaseOrder`, etc.) as a "loose-shape escape hatch" so consumers can read fields the interface doesn't enumerate. **Replace with `[key: string]: unknown`.**

- This forces consumers to narrow / cast at the point of use rather than silently propagating `any` through the program.
- It does NOT remove fields — every named field stays typed.
- Behavior is preserved: consumers that cast (`row.foo as string`) keep working; consumers that did `row.foo.bar` without narrowing now get a type error and need a one-line fix.

If a downstream consumer breaks because it relied on `any` indexing, fix that consumer minimally (cast at the point of use). If breakage is large, fall back to `Rule 4`.

### Rule 2 — `Record<string, any>` payloads / metadata blobs

These are bag-of-fields payloads (`metadata`, `changes`, `allocations`, `features`, `subscription`, etc.). **Replace with `Record<string, unknown>`.** Same reasoning as Rule 1.

### Rule 3 — `Array<Record<string, any>>` and `Record<string, any>[]` lists

Lists of bag-of-field rows (e.g. `top_products`, `daily_trend`, `lines: Record<string, any>[]`). **Replace with `Array<Record<string, unknown>>` / `Record<string, unknown>[]`.** Same reasoning.

### Rule 4 — Specific `any` fields whose shape is enumerated elsewhere

Cases where the field is genuinely well-shaped (e.g. `SaasUsageData.users` which is a `{ used; limit; ... }` object across the codebase) — define an inline interface or a helper type.

For `SaasUsageData` specifically, the runtime shape is `{ used: number; limit: number; remaining?: number } | null` per `useOrganizationDetail.ts` and the SaaS Org page. We narrow it once.

If consumer breakage is too wide for this pass to fix, fall back to `unknown` and add `// TODO(phase5): narrow once consumers migrated` with the consumer file list.

### What we explicitly do NOT do

- We do NOT add `as any` casts in consumers. If a consumer breaks, fix it with a real narrowing or interface.
- We do NOT silence errors with `// @ts-ignore` or `// @ts-expect-error`.
- We do NOT add zod/valibot/yup schemas. Phase 5 is purely TypeScript-level; runtime validation is a separate, optional follow-up.

---

## Replacement table — every `any` in `src/types/erp.ts`

| Line(s) | Type / context | Replacement | Rule |
|---:|---|---|---|
| `JournalEntry.[key: string]: any` | index sig | `unknown` | 1 |
| `Voucher.[key: string]: any` | index sig | `unknown` | 1 |
| `FiscalYear.[key: string]: any` | index sig | `unknown` | 1 |
| `Payment.[key: string]: any` | index sig | `unknown` | 1 |
| `FinancialEvent.metadata?: Record<string, any>` | payload | `Record<string, unknown>` | 2 |
| `FinancialEvent.[key: string]: any` | index sig | `unknown` | 1 |
| `Asset.[key: string]: any` | index sig | `unknown` | 1 |
| `DeferredExpense.[key: string]: any` | index sig | `unknown` | 1 |
| `TaxGroup.[key: string]: any` | index sig | `unknown` | 1 |
| `TaxSummary.[key: string]: any` | index sig | `unknown` | 1 |
| `ProfitDistribution.allocations?: Record<string, any>` | payload | `Record<string, unknown>` | 2 |
| `ProfitDistribution.[key: string]: any` | index sig | `unknown` | 1 |
| `AuditTrailEntry.changes?: Record<string, any>` | payload | `Record<string, unknown>` | 2 |
| `Product.[key: string]: any` | index sig | `unknown` | 1 |
| `Warehouse.[key: string]: any` | index sig | `unknown` | 1 |
| `TransferOrder.lines?: ... \| Record<string, any>[]` | list | `Record<string, unknown>[]` | 3 |
| `TransferOrder.[key: string]: any` | index sig | `unknown` | 1 |
| `AdjustmentOrder.lines?: ... \| Record<string, any>[]` | list | `Record<string, unknown>[]` | 3 |
| `AdjustmentOrder.[key: string]: any` | index sig | `unknown` | 1 |
| `OperationalRequest.lines?: ... \| Record<string, any>[]` | list | `Record<string, unknown>[]` | 3 |
| `OperationalRequest.[key: string]: any` | index sig | `unknown` | 1 |
| `SalesOrder.lines?: Record<string, any>[]` | list | `Record<string, unknown>[]` | 3 |
| `SalesOrder.[key: string]: any` | index sig | `unknown` | 1 |
| `SalesReturn.[key: string]: any` | index sig | `unknown` | 1 |
| `DeliveryOrder.[key: string]: any` | index sig | `unknown` | 1 |
| `DeliveryZone.[key: string]: any` | index sig | `unknown` | 1 |
| `DiscountRule.[key: string]: any` | index sig | `unknown` | 1 |
| `PurchaseOrder.[key: string]: any` | index sig | `unknown` | 1 |
| `PurchaseOrderLine.[key: string]: any` | index sig | `unknown` | 1 |
| `PurchaseReturn.[key: string]: any` | index sig | `unknown` | 1 |
| `Contact.[key: string]: any` | index sig | `unknown` | 1 |
| `Employee.[key: string]: any` | index sig | `unknown` | 1 |
| `UserApproval.[key: string]: any` | index sig | `unknown` | 1 |
| `LifecycleHistoryEntry.[key: string]: any` (CRM-side, dup name) | index sig | `unknown` | 1 |
| `ValuationResponse.products?: Record<string, any>[]` | list | `Record<string, unknown>[]` | 3 |
| `ValuationResponse.[key: string]: any` | index sig | `unknown` | 1 |
| `LowStockResponse.products?: Record<string, any>[]` | list | `Record<string, unknown>[]` | 3 |
| `LowStockResponse.[key: string]: any` | index sig | `unknown` | 1 |
| `ExpiryAlertResponse.alerts?: Record<string, any>[]` | list | `Record<string, unknown>[]` | 3 |
| `ExpiryAlertResponse.[key: string]: any` | index sig | `unknown` | 1 |
| `ImportResult.[key: string]: any` | index sig | `unknown` | 1 |
| `UsageLog.[key: string]: any` | index sig | `unknown` | 1 |
| `SalesAnalyticsData.top_products / top_customers / daily_trend / payment_methods / site_performance: Record<string, any>[]` | list | `Record<string, unknown>[]` | 3 |
| `SalesAnalyticsData.[key: string]: any` | index sig | `unknown` | 1 |
| `PurchaseLine.[key: string]: any` | index sig | `unknown` | 1 |
| `Category.[key: string]: any` | index sig | `unknown` | 1 |
| `Brand.[key: string]: any` | index sig | `unknown` | 1 |
| `ProductAttribute.[key: string]: any` | index sig | `unknown` | 1 |
| `PublicConfigTenant.roles?: Array<{... [key: string]: any}>` | list elem index | `unknown` | 1 |
| `PublicConfigTenant.sites?: Array<{... [key: string]: any}>` | list elem index | `unknown` | 1 |
| `PublicConfigTenant.[key: string]: any` | index sig | `unknown` | 1 |
| `PublicConfig.business_types / currencies array element index` | list elem index | `unknown` | 1 |
| `PublicConfig.[key: string]: any` | index sig | `unknown` | 1 |
| `ContactSummaryData.contact.[key: string]: any` | index sig | `unknown` | 1 |
| `ContactSummaryData.orders.recent: Array<Record<string, any>>` | list | `Array<Record<string, unknown>>` | 3 |
| `ContactSummaryData.orders.stats.[key: string]: any` | index sig | `unknown` | 1 |
| `ContactSummaryData.payments.recent / .stats` | list / index | mixed | 1+3 |
| `ContactSummaryData.balance.[key: string]: any` | index sig | `unknown` | 1 |
| `ContactSummaryData.journal_entries: Array<Record<string, any>>` | list | `Array<Record<string, unknown>>` | 3 |
| `ContactSummaryData.analytics.top_products / [key]` | list / index | mixed | 1+3 |
| `ContactSummaryData.pricing_rules: Array<Record<string, any>>` | list | `Array<Record<string, unknown>>` | 3 |
| `ContactSummaryData.[key: string]: any` | index sig | `unknown` | 1 |
| `SaasOrganization.modules / sites: Array<Record<string, any>>` | list | `Array<Record<string, unknown>>` | 3 |
| `SaasOrganization.subscription?: Record<string, any>` | payload | `Record<string, unknown>` | 2 |
| `SaasOrganization.[key: string]: any` | index sig | `unknown` | 1 |
| `SaasUsageData.users / products / orders / storage / api_calls / sites / invoices / modules: any` | metric | new `SaasUsageMetric` interface | 4 |
| `SaasUsageData.[key: string]: any` | index sig | `unknown` | 1 |
| `SaasBillingData.history: Array<Record<string, any>>` | list | `Array<Record<string, unknown>>` | 3 |
| `SaasBillingData.balance.[key: string]: any` | index sig | `unknown` | 1 |
| `SaasBillingData.client: Record<string, any> \| null` | payload | `Record<string, unknown> \| null` | 2 |
| `SaasBillingData.[key: string]: any` | index sig | `unknown` | 1 |
| `SaasAddonData.purchased / available: Array<Record<string, any>>` | list | `Array<Record<string, unknown>>` | 3 |
| `SaasAddonData.[key: string]: any` | index sig | `unknown` | 1 |
| `SaasPlan.features?: Record<string, any>` | payload | `Record<string, unknown>` | 2 |
| `SaasPlan.addons?: Array<Record<string, any>>` | list | `Array<Record<string, unknown>>` | 3 |
| `SaasPlan.[key: string]: any` | index sig | `unknown` | 1 |
| `SaasUpdateStatus.[key: string]: any` | index sig | `unknown` | 1 |
| `SerialNumber.[key: string]: any` | index sig | `unknown` | 1 |
| `SerialHistoryLog.[key: string]: any` | index sig | `unknown` | 1 |
| `AdminHierarchyProduct.[key: string]: any` | index sig | `unknown` | 1 |
| `AdminHierarchyGroup.[key: string]: any` | index sig | `unknown` | 1 |
| `AdminHierarchyBrandData.[key: string]: any` | index sig | `unknown` | 1 |
| `AdminCountryHierarchyItem.[key: string]: any` | index sig | `unknown` | 1 |
| `AdminEntity.countries / categories array elem index sig` | list elem index | `unknown` | 1 |
| `AdminEntity.products?: Array<Record<string, any>>` | list | `Array<Record<string, unknown>>` | 3 |
| `AdminEntity.[key: string]: any` | index sig | `unknown` | 1 |
| `PackageStats.[key: string]: any` | index sig | `unknown` | 1 |
| `SaasModule / SaasUser / SaasSite / SaasAddon / PlanCategory / SaasUpdateHistoryEntry / SaasBackup.[key: string]: any` | index sig | `unknown` | 1 |
| `SidebarDynamicItem.[key: string]: any` | index sig | `unknown` | 1 |
| `AppNotification.[key: string]: any` | index sig | `unknown` | 1 |
| `BusinessType.[key: string]: any` | index sig | `unknown` | 1 |
| `Currency.[key: string]: any` | index sig | `unknown` | 1 |
| `AppUser.[key: string]: any` | index sig | `unknown` | 1 |
| `AuthActionState.error.[key: string]: any` | index sig | `string \| string[] \| undefined` | 4 (sibling fields are this union) |
| `AuthActionState.[key: string]: any` | index sig | `unknown` | 1 |
| `ActionResult<T = Record<string, any>>` | default generic | `Record<string, unknown>` | 2 |
| `RefCountry.[key: string]: any` | index sig | `unknown` | 1 |
| `RefCurrency.[key: string]: any` | index sig | `unknown` | 1 |
| `CountryCurrencyMap.[key: string]: any` | index sig | `unknown` | 1 |
| `OrgCountry.[key: string]: any` | index sig | `unknown` | 1 |
| `OrgCurrency.[key: string]: any` | index sig | `unknown` | 1 |

### Note on the duplicate `LifecycleHistoryEntry`

The file declares `LifecycleHistoryEntry` twice (L326-334 and L776-783). This is a pre-existing bug — TypeScript actually treats the second declaration as a redefinition error in strict mode, but the project compiles cleanly because the second one is only consumed where the first one wasn't imported. We do **not** fix the duplicate in this pass (out of scope; it's a separate cleanup item).

---

## Step-by-step

1. **Replace `[key: string]: any` → `[key: string]: unknown`** across the whole file (one batch).
2. **Replace `Record<string, any>` → `Record<string, unknown>`** across the whole file (one batch).
3. **Replace `: any` standalone fields** (`SaasUsageData.users` etc.) with their narrowed types (Rule 4).
4. **Replace `any` in generic defaults** (`ActionResult<T = Record<string, any>>`).
5. Run `npx tsc --noEmit`. Fix any consumer breakage by either:
   - Casting at the consumer site (`obj.field as string`)
   - Adding a type guard
   - Defining a local interface in the consumer
6. Re-run `npx tsc --noEmit` until exit 0.
7. Update this plan with: (a) actual `any` count removed from `erp.ts` (target: 94 → 0), (b) consumer files touched.

---

## Verification

```bash
# Must be 0:
grep -c ": any\b\|<any>\| any\[\]\|as any" src/types/erp.ts

# Must be 0 errors (matches baseline):
npx tsc --noEmit
echo "exit=$?"
```

---

## Risk register

- **R1**: Index-signature narrowing breaks consumers that index without casting → fix per-file with cast or interface. Already triaged above.
- **R2**: `Record<string, any>` → `Record<string, unknown>` breaks consumers that pass these into helpers expecting any-shape → cast at the call site.
- **R3**: A consumer relies on a non-existent field via the `[key]: any` escape hatch (silent bug) → it surfaces as a tsc error, which is a feature not a bug.
- **R4**: `SaasUsageData.users` type narrowing is too tight for a real-world response → fall back to `unknown` and add `// TODO(phase5)`.

---

## Out of scope (next batches in Phase 5)

- The 20 hottest non-`erp.ts` files (see _Per-file hotspots_ above).
- Removing the duplicate `LifecycleHistoryEntry` in `erp.ts`.
- Migrating consumers' own internal `any` usage to typed interfaces.
- Runtime validation libraries.

---

## Result (filled in after the pass)

- `any`s removed from `src/types/erp.ts`: **94 → 0** (all 94 narrowed). Final `grep` count: 0.
- Consumer files touched: **5**
  - `src/app/(privileged)/(saas)/organizations/[id]/_hooks/useOrganizationDetail.ts` (cast `usage[k] as Record<string, unknown>` for SaasUsageMetric helper, and explicit type for `currentSubscription` field reads)
  - `src/app/actions/setup-wizard.ts` (cast `state.error[name]` for unknown index-signature fallback)
  - `src/app/(privileged)/(saas)/organizations/[id]/_components/UsageTab.tsx` (1 cast)
  - `src/components/admin/_lib/parse-dynamic-items.ts` (1 cast)
  - `src/app/(auth)/login/LoginContent.tsx` (1 cast — `state` index-signature read)
- Final `npx tsc --noEmit`: **exit 0** (matches baseline).
- Compromises: none. No `// TODO(phase5)` left behind.
