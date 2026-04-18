# Code Quality — File Size Limits

## Maximum File Length

Every source file MUST stay under **300 lines**. If a file exceeds this limit, it MUST be refactored before any new work continues.

### Thresholds

| Lines     | Action Required                                                  |
|-----------|------------------------------------------------------------------|
| ≤ 300     | ✅ Acceptable — no action needed                                 |
| 301 – 400 | ⚠️ Warning — plan a refactor in same PR                          |
| 401+      | 🛑 MANDATORY refactor — split before adding any new code         |

### How to Refactor

1. **Components (`.tsx`)**: Extract sub-components into `_components/` folder
2. **Logic / hooks**: Extract into `_lib/` or `_hooks/` folder
3. **Constants / config**: Extract into `_lib/constants.ts`
4. **Types**: Extract into `_lib/types.ts`
5. **Server Actions (`.ts`)**: Split by entity or domain into separate action files
6. **Backend Views (`.py`)**: Split into separate ViewSet files per model
7. **Backend Services (`.py`)**: Split by responsibility into separate service files

### Naming Convention for Extracted Files

```
page.tsx              → stays as thin wrapper (< 30 lines)
manager.tsx           → main orchestration component (< 300 lines)
_components/          → extracted UI sub-components
_lib/constants.ts     → column defs, configs, status maps
_lib/types.ts         → shared types and interfaces
_lib/profiles.ts      → localStorage / persistence logic
_hooks/               → extracted custom hooks
```

### Example: Refactoring a 500-line page

```
BEFORE:
  page.tsx (500 lines) — header, KPIs, table, filters, dialogs, logic

AFTER:
  page.tsx (15 lines)           — thin wrapper
  manager.tsx (250 lines)       — main orchestration
  _components/FiltersPanel.tsx   — filter UI
  _components/ExpandedRow.tsx    — expanded detail view
  _lib/constants.ts              — columns, status config
  _lib/types.ts                  — shared types
```

### Rules

1. **Never create a new file over 300 lines.** Plan the split upfront.
2. **When modifying an existing file over 300 lines**, refactor it first before adding new code.
3. **Page files (`page.tsx`)** should be thin wrappers (< 30 lines) that import a Manager component.
4. **`@ts-nocheck` files** over 300 lines are especially high-priority for refactoring.
5. **Barrel exports (`index.ts`)** are exempt from this limit.
6. **Test files** are exempt from this limit.
7. **Migration files (`.py`)** are exempt from this limit.
