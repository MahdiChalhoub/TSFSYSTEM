# Plan — Numbering & Codes Redesign

**Date**: 2026-04-30
**Scope**: Visual-only redesign of `settings/sequences` page
**Risk**: LOW (frontend only, no model changes, no migrations, no API changes)

---

## What changes

Three files only:
1. `src/app/(privileged)/settings/sequences/page.tsx`
2. `src/app/(privileged)/settings/sequences/_components/SequenceTable.tsx`
3. `src/app/(privileged)/settings/sequences/_components/SequenceRow.tsx`

## What does NOT change

- `_lib/types.ts` — `Sequence` shape stays identical (`type / prefix / suffix / next_number / padding`)
- `_lib/constants.ts` — `DOCUMENT_GROUPS`, `MASTER_DATA_GROUPS`, `TIERS`, `DEFAULT_PREFIXES`, `resolveSeqKey()` — all reused unchanged
- `actions/sequences.ts`, `lib/sequences.ts`, `lib/sequences-client.ts` — untouched
- Backend `finance/sequences/` endpoint — untouched
- `SettingsPageShell` — kept as wrapper (handles title/save/reload header)
- `erpFetch`, sonner, lucide-react — same dependencies

## Architecture compliance

| Rule | Compliance |
|---|---|
| TenantOwnedModel + AuditLogMixin | N/A — no models touched |
| `get_config()` for values | N/A — no Python; frontend uses typed constants per existing pattern |
| Events for cross-module | N/A — no cross-module communication |
| RBAC permission check | N/A — page-level RBAC handled by `(privileged)` route group |
| No hardcoded colors | ✅ Use `var(--app-*)` tokens only |
| No cross-module imports | ✅ Only imports from `_lib`, `_components`, `@/components/ui`, `@/lib/*` |
| Module boundaries | ✅ Settings page consumes finance API (existing contract) |

## Design changes (the actual redesign)

### 1. Entity row restructure (biggest win)
**Before**: 3 rows per entity, 2 with blank entity column, 4 separate input fields per row, tiny right-aligned preview.
**After**: 1 entity row per document type containing 3 horizontal **tier specimen cards**. Entity name and icon appear once. Each tier card has the live preview as its hero (large mono, accent-colored prefix, dimmed leading zeros). Edit fields collapse into compact inline controls beneath the preview. Tier color saturates the whole card, not just a 9px badge.

### 2. Group section visual treatment
**Before**: a stripe header with a small colored dot + count.
**After**: a **left color rail** runs the full height of each module group; group header carries the same color in a larger smallcaps treatment. Group becomes a clear container, not just a divider.

### 3. KPI strip
**Before**: 4 small icon-card chips, all the same weight.
**After**: a single **inline strip** with hairline dividers, big tabular-num values, smallcaps labels. "Unsaved" cell turns warning-warm when > 0. Density up, height down.

### 4. Tier model legend
**Before**: a single info banner, glanced once.
**After**: still present, but redesigned as a 3-column **legend card** with a swatch per tier — and the same swatch color reappears on every tier specimen, reinforcing the model everywhere.

### 5. Sticky save bar
**Before**: full-width sticky panel at the bottom with a generic count.
**After**: floating pill anchored bottom-center with the count and a quick "Save / Discard" pair, animated in.

### 6. Per-tier reset action (additive, no model change)
A small `↻` button next to each tier card resets `next_number` to 1 client-side via the existing `onChange` flow. No new backend.

### 7. Master-data tab
Same redesign principles applied: entity rows become single specimen cards (no tier dimension). Group color rails carry through.

### 8. Empty/loading states
Loading: replace generic spinner with a subtle skeleton matching the new entity-row shape so layout doesn't reflow.

## Tokens used (theme system)

All colors via existing CSS variables only:
`--app-primary` `--app-success` `--app-warning` `--app-info` `--app-error`
`--app-surface` `--app-background` `--app-foreground` `--app-muted-foreground` `--app-border`

No raw hex. No new variables.

## Out of scope (explicitly NOT in this PR)

- Format token system (`{YYYY}`, `{seq:6}`, `{site}`) — would require model + API changes
- Per-tier reset rules (annually / monthly / fiscal) — would require model + API changes
- Configurable tier list beyond Draft/Internal/Official — would require model + API changes
- No-gaps enforcement on Official tier — already in backend if implemented; surface only
- Audit log tab — would require new endpoint
- Per-tier RBAC split — would require RBAC config changes

These can be follow-ups if you want them; flagging now so they don't sneak in.

## Verification

- `pnpm build` (or `npm run build` / `yarn build`) — type-check must pass
- Manual: open `/settings/sequences`, edit a prefix, confirm preview updates, save, reload → persists
- Master-Data tab renders with new card layout
- Dark/light theme: both render correctly via CSS variables

## Files-touched checklist

- [ ] `page.tsx` — rebuild layout
- [ ] `SequenceTable.tsx` — entity-row restructure, tier specimen cards
- [ ] `SequenceRow.tsx` — replaced with `TierCard` (kept under same filename to minimize import churn) OR new component file alongside
- [ ] Run typecheck
- [ ] Visual smoke test
