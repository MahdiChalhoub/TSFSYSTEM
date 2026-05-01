# Maintainability Phase 2 — Split Giant Frontend Files

**Status**: DONE 2026-04-30
**Priority**: HIGH
**Created**: 2026-04-30
**Estimated effort**: ~3 hours
**Risk**: LOW (pure refactor, zero behavior change, zero prop change)

---

## MANDATORY — Read First

1. `.agent/BOOTSTRAP.md`
2. `.ai/ANTIGRAVITY_CONSTRAINTS.md`
3. `architecture.md` rule (code-quality: ≤300 lines per file)
4. `task and plan/maintainability/maintainability_phase1_backend_splits_001.md` — the Phase 1 plan, which established the patterns: standalone-function + staticmethod re-attachment for services, mixin classes for ViewSets. Phase 2 mirrors this for React.

---

## Goal

Split the three biggest `.tsx` files into focused modules, each ≤300 lines.
**Zero behavior change. Zero prop change. Zero import-path change for external callers.**

| File | Lines | New siblings | New file root |
|---|---|---|---|
| `FxRedesigned.tsx` | 2,537 | ~10 | `_fx/` |
| `FxManagementSection.tsx` | 2,031 | ~7 | `_fx_management/` |
| `TemplatesPageClient.tsx` | 1,999 | ~10 | `_components/` (templates dir) |

---

## File 1: `FxRedesigned.tsx` (2,537 → ~280 lines)

**Path**: `src/app/(privileged)/settings/regional/_components/FxRedesigned.tsx`
**Imported by**: `src/app/(privileged)/settings/regional/client.tsx`

### Sub-files in `src/app/(privileged)/settings/regional/_components/_fx/`

- `constants.ts` — `HEALTH`, `PROVIDER_META`, `FREQ_LABEL`, `RATE_TYPES`, `FxView`, `HealthKey` types
- `RateRulesView.tsx` — `RateRulesView` (+ tiny `Search24` helper)
- `PolicyCard.tsx` — `PolicyCard`
- `RateHistoryView.tsx` — `RateHistoryView`
- `EditRateModal.tsx` — `EditRateModal`
- `PolicyDrawer.tsx` — `PolicyDrawer` (split further if >300 after extraction)
- `SetBrokerModal.tsx` — `SetBrokerModal`
- `ManualRate.tsx` — `ManualRateModal` + `ManualRateForm` (split if combined >300)
- `PairChart.tsx` — `PairChart` + `Sparkline`
- `atoms.tsx` — `RateColumn`, `MenuItem`, `PanelGroup`, `PrefixInput`, `SegSelect`, `FxSkeleton`, `EmptyState`
- `SubTabBar.tsx` — `SubTabBar`

If the main `FxRedesigned` orchestrator exceeds 300 lines after extraction, lift state into `_fx/useFxState.ts` (custom hook) or split renderer branches into `_fx/views/`.

---

## File 2: `FxManagementSection.tsx` (2,031 → ~280 lines)

**Path**: `src/app/(privileged)/settings/regional/_components/FxManagementSection.tsx`
**Imported by**: `src/app/(privileged)/settings/regional/client.tsx`

### Sub-files in `src/app/(privileged)/settings/regional/_components/_fx_management/`

- `constants.ts` — `RATE_TYPES`, `SUB_TABS`, `FxView`, `Period`, `FiscalYear`, `HEALTH_COLOR`, `HEALTH_LABEL`, `INPUT_CLS`, `INPUT_STYLE`, `grad`, `soft`, `statusPill`
- `atoms.tsx` — `SectionHeader`, `PrimaryButton`, `EmptyState`, `SyncStatusBadge`, `HealthPill`, `FreshSyncBadge`, `BasePill`, `FieldLabel`
- `NewRateForm.tsx` — `NewRateForm`
- `NewPolicyForm.tsx` — `NewPolicyForm` (sub-split if >300)
- `views/RatesView.tsx`, `views/PoliciesView.tsx`, `views/RevaluationsView.tsx` — pull each `view === 'X'` branch out of the 1,320-line orchestrator if state coupling allows.

---

## File 3: `TemplatesPageClient.tsx` (1,999 → ~280 lines)

**Path**: `src/app/(privileged)/finance/chart-of-accounts/templates/TemplatesPageClient.tsx`
**Imported by**: `src/app/(privileged)/finance/chart-of-accounts/templates/TemplatesGateway.tsx`

### Sub-files in `src/app/(privileged)/finance/chart-of-accounts/templates/_components/`

- `icons.ts` — `ICON_MAP`, `resolveIcon`, `ACCENT_MAP`
- `types.ts` — `TemplateInfo`, `Props`, shared types
- `GalleryView.tsx`, `TemplateDetail.tsx`, `PostingRulesPanel.tsx`, `AccountTreeNode.tsx`, `CompareView.tsx`, `EmptyState.tsx`
- `migration/helpers.ts` — `flattenAccounts`, `normalizeName`, `wordSimilarity`, `findAccountName`, type aliases
- `migration/MigrationView.tsx` — split further (661 lines → multiple files in `migration/`)
- `migration/MigrationExecutionView.tsx` — split if over 300

---

## Pattern: React Mixin / Composition

Mirroring Phase 1's mixin-for-services pattern:

```tsx
// _fx/PolicyCard.tsx
'use client'
export function PolicyCard({ ... }: PolicyCardProps) { ... }

// FxRedesigned.tsx (orchestrator)
'use client'
import { PolicyCard } from './_fx/PolicyCard'
import { RateHistoryView } from './_fx/RateHistoryView'
// ... etc

export function FxRedesigned({ view, orgCurrencyCount, orgBaseCode }: Props) {
  // state + effects
  return <>{view === 'rates' ? <PolicyCard ... /> : <RateHistoryView ... />}</>
}
```

Children own their own hooks. Parent owns shared state and passes via props.

---

## URL / Route Behavior

**Zero changes.** All three components remain importable from their current paths with their current export names. URL routing is unaffected.

---

## Verification

```bash
# 1. TypeScript — must show ZERO new errors vs baseline (currently 0)
npx tsc --noEmit

# 2. Lint
npx eslint src/app/\(privileged\)/settings/regional/_components/ src/app/\(privileged\)/finance/chart-of-accounts/templates/

# 3. 300-line compliance — should return empty for the new dirs
find src/app/\(privileged\)/settings/regional/_components/ \
     src/app/\(privileged\)/finance/chart-of-accounts/templates/ \
     -name "*.tsx" -o -name "*.ts" | \
  xargs wc -l 2>/dev/null | awk '$1 > 300 && !/total$/' | sort -rn

# 4. Smoke-render the routes (manual / e2e)
npx playwright test --project=finance --grep "regional|templates"
```

---

## Critical Rules for the Executing Agent

1. **PURE REFACTOR.** Zero logic / prop / hook-order / JSX changes. Move code verbatim.
2. **PRESERVE `'use client'`** on every file that uses hooks.
3. **Hooks rules**: Don't extract hook calls into render paths. Components keep their own hooks.
4. **Types**: Co-locate inline `Props` types with the component; share top-level types via `constants.ts` / `types.ts`.
5. **No new dependencies.** Re-organize imports only.
6. **Hardcoded colors**: Don't touch them — Phase 6's scope.
7. **Verify after each file**: `npx tsc --noEmit` must show zero new errors.
8. **If a sub-file ends up >300**: split further. The cap is non-negotiable.
