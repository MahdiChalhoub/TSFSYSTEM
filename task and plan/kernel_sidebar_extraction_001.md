# Plan — Kernel Sidebar extraction (kernel_sidebar_extraction_001)

**Status**: DONE 2026-04-19 (code + typecheck) — browser smoke-test + commit pending
**Module**: kernel (core admin shell)
**Author**: Claude Code (Opus 4.7, 1M)
**Date**: 2026-04-19

## Goal

Bring `src/components/admin/Sidebar.tsx` (**1,362 lines**) under the 300-line code-quality limit without changing runtime behavior. Keep the hybrid nav architecture (core routes frontend-owned, business-module routes dynamic) — this is **not** the "total dynamic binding" migration; it's an extract-to-data-module refactor.

## Non-goal (explicitly)

- Do **not** move kernel route definitions into Django manifests.
- Do **not** touch [views_saas_modules.py:306-310](erp_backend/erp/views_saas_modules.py#L306-L310) — its "skip core modules" guard stays.
- Do **not** change the public shape of `MENU_ITEMS` — 7 external importers rely on it (see Blast radius).

## Current structure (verified)

| Range | Contents | Size |
|---|---|---|
| 1–69 | Imports (lucide icons, React, actions, contexts) | 69 |
| 70–120 | `ICON_MAP` record | 51 |
| 121–123 | `getIcon()` helper | 3 |
| 127–842 | `MENU_ITEMS` tree — 22 top-level modules | 717 |
| 844–860 | `parseDynamicItems()` helper | 17 |
| 862–1215 | `Sidebar` component | ~354 |
| 1217–1362 | `MenuItem` recursive sub-component | ~146 |

## Blast radius — current `MENU_ITEMS` importers

Verified via grep (must remain unchanged post-refactor):

- [src/components/mobile/shell/MobileDrawer.tsx:15](src/components/mobile/shell/MobileDrawer.tsx#L15)
- [src/components/mobile/shell/MobileBottomNav.tsx:16](src/components/mobile/shell/MobileBottomNav.tsx#L16)
- [src/components/mobile/shell/MobileTopHeader.tsx:15](src/components/mobile/shell/MobileTopHeader.tsx#L15)
- [src/components/admin/TabNavigator.tsx:4](src/components/admin/TabNavigator.tsx#L4)
- [src/components/admin/TopHeader.tsx:4](src/components/admin/TopHeader.tsx#L4)
- [src/components/admin/CommandPalette.tsx:29](src/components/admin/CommandPalette.tsx#L29)
- [src/app/(privileged)/home/page.tsx:4](src/app/(privileged)/home/page.tsx#L4)

All seven continue to `import { MENU_ITEMS } from '@/components/admin/Sidebar'` — Sidebar.tsx re-exports it from the new location. Zero importer touched.

## Design decisions (for approval)

### D1 — Where does `MENU_ITEMS` live?

The tree is **717 lines of data** — it cannot fit in a single <300-line file. Two options:

| Option | Shape | Files | Tradeoff |
|---|---|---|---|
| **D1-A (recommended)** | Split by module: `_lib/menu/finance.ts`, `_lib/menu/crm.ts`, …, `_lib/menu/core.ts`. Barrel at `_lib/menu/index.ts` concatenates. | 1 barrel + ~12 module files, each <150 lines | Each file mirrors a Django app → next time a module grows a new page, the change is local. Natural seam if we ever *do* go fully dynamic later (each file becomes a manifest). |
| **D1-B** | Single `_lib/menu-items.ts` (~720 lines). Accept over-limit on grounds that code-quality.md is about *logic* files, not data. | 1 file | Simpler diff. But the rule says "Never create a new file over 300 lines" — no data-file exception is written. |

**Recommendation: D1-A.** It's marginally more setup but respects the rule and creates the right seam.

### D2 — Does Sidebar.tsx fit under 300 after data extraction alone?

No. With data + icon-map + MenuItem extracted, Sidebar.tsx is ~**380 lines** — still over. Need one more split. Options:

- **D2-A (recommended)**: extract Sidebar's internal hooks (`useInstalledModules`, `useDynamicItems`, search/filter state) into `_hooks/useSidebar.ts`. Target: Sidebar.tsx ~250 lines.
- **D2-B**: extract the favorites panel JSX block into `_components/FavoritesPanel.tsx`. Similar target.

Both can be done; I'd do D2-A first and only D2-B if still over.

## Files

### New files

```
src/components/admin/
  _lib/
    icon-map.ts                 — ICON_MAP + getIcon()             (~55 lines)
    parse-dynamic-items.ts      — parseDynamicItems() helper       (~25 lines)
    menu/
      index.ts                  — barrel: concatenates all modules (~20 lines)
      core.ts                   — Dashboard, Platform Dashboard, AI Agents, Delivery, Setup Wizard (~20 lines)
      finance.ts                — Finance tree                      (~80–120 lines — longest module)
      crm.ts                    — CRM tree                          (<150)
      inventory.ts              — Inventory tree                    (<150)
      pos.ts                    — POS tree                          (<150)
      hr.ts                     — HR tree                           (<150)
      saas.ts                   — SaaS kernel routes                (<150)
      …one file per top-level MENU_ITEMS entry                     (<150 each)
  _components/
    MenuItem.tsx                — recursive menu item renderer     (~150 lines)
  _hooks/
    useSidebar.ts               — Sidebar internal state + effects (~120 lines, per D2-A)
```

Exact module-file list finalised during implementation by walking the current tree.

### Modified files

- `src/components/admin/Sidebar.tsx` → trimmed to Sidebar component only + barrel re-exports:
  ```ts
  export { MENU_ITEMS } from './_lib/menu';
  export { Sidebar } from './Sidebar'; // default already there
  ```
  Target: **≤300 lines** (soft target ~250).

### Unchanged

- All 7 MENU_ITEMS importers.
- `erp_backend/erp/views_saas_modules.py` (architectural guard preserved).
- `parseDynamicItems` callsite behaviour (helper moves but import path shifts to `./_lib/parse-dynamic-items` — only used inside Sidebar itself, zero external impact).

## Migrations

None. Pure TypeScript refactor, no DB, no Django, no manifest changes.

## Tests / Validation

No unit tests currently exist for Sidebar.tsx. Verification is behavioural:

1. **Typecheck**: `cd src && npx tsc --noEmit` (or whatever the repo uses — inspect `package.json` scripts first). Must pass.
2. **Build**: `npm run build` — must pass.
3. **Grep invariants** (post-refactor):
   - `MENU_ITEMS` symbol exported from `src/components/admin/Sidebar.tsx` (barrel) — 7 importers unchanged.
   - No new `import` cycles (check by running `madge` if available, else visual).
4. **Line-count invariants**:
   - `wc -l src/components/admin/Sidebar.tsx` ≤ 300.
   - Every new file ≤ 300 lines.
5. **Behavioural smoke-test** (user-run; I cannot run a browser):
   - Sidebar renders on `/dashboard` desktop.
   - Favorites panel still works.
   - Expand/collapse of a multi-level node (e.g. Finance → Settings → COA Templates) still works.
   - Mobile drawer renders the same tree.
   - Command palette search finds the same items as before.
   - Tab navigator opens tabs correctly.

## Risk

**Low.** Pure mechanical move of data + helpers. The only risk surfaces:

| Risk | Mitigation |
|---|---|
| Icon import path breakage (lucide imports currently live in Sidebar.tsx; some move to `menu/*.ts` files) | Each menu module file imports only the icons it uses. Unused imports removed. Typecheck catches misses. |
| Menu tree shape drift during split | Diff the concatenated output of `_lib/menu/index.ts` against the original `MENU_ITEMS` array using a throwaway `JSON.stringify` check before deleting the old block. |
| External importer breakage | Keep `MENU_ITEMS` exported from `Sidebar.tsx` as a barrel. Grep verifies all 7 importers resolve. |
| `parseDynamicItems` hidden dep on a Sidebar-local closure | Read the current body — it's a pure function of its argument and `getIcon`. Safe to extract as-is. |

## Out of scope

- Moving core routes to Django manifests (rejected in this session's discussion — separate multi-week migration).
- Updating [views_saas_modules.py:306-310](erp_backend/erp/views_saas_modules.py#L306-L310).
- Typing tightening on `ICON_MAP` (`Record<string, any>` stays `any` for now).
- i18n of menu labels.
- Removing unused lucide icon imports anywhere other than what the split naturally cleans up.

## Execution order (if approved)

1. Create `_lib/icon-map.ts` (move `ICON_MAP` + `getIcon`). Update Sidebar.tsx to import from it. Typecheck.
2. Create `_lib/parse-dynamic-items.ts`. Update Sidebar.tsx. Typecheck.
3. Create `_lib/menu/` directory. Walk the 22 top-level entries. For each, create `_lib/menu/{module}.ts` exporting an array. Create `_lib/menu/index.ts` that concatenates them and re-exports as `MENU_ITEMS`. Delete the inline array in Sidebar.tsx. Add barrel re-export. Typecheck.
4. Pre-delete sanity: serialise old `MENU_ITEMS` to JSON, serialise new one, assert equal. Discard script.
5. Create `_components/MenuItem.tsx` (move recursive renderer). Typecheck.
6. If Sidebar.tsx still >300, apply D2-A: extract `_hooks/useSidebar.ts`. Typecheck.
7. Run `npm run build`.
8. Hand off for browser smoke-test using the checklist above.
9. Single commit: `[refactor] KERNEL: extract MENU_ITEMS and helpers from Sidebar.tsx`.

## Estimated effort

~3–4 hours active work. One session. No external blockers.

## Approval checklist (for user)

- [ ] D1: choose A (split by module) or B (single data file)
- [ ] D2: approve hooks extraction (A) — add favorites panel extraction (B) only if still over
- [ ] Confirm single-commit approach (vs. split per extraction step)
- [ ] Confirm smoke-test checklist is sufficient or add items
