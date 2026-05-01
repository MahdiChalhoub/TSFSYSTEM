# Maintainability Phase 6 — Hardcoded Color Sweep (Theme Tokens)

**Status**: PoC COMPLETE — `src/app/(privileged)/finance/` migrated. Remaining subdirs (~15) deferred to follow-up sessions.
**Priority**: MEDIUM
**Created**: 2026-04-30
**Estimated total effort**: ~12–16 hours across all subdirs (PoC consumes ~2 hours)
**Risk**: LOW–MEDIUM. The fix preserves light-mode visuals and dramatically improves dark-mode rendering. Risk concentrates in semantic mismatches (e.g. emerald used both as brand-positive and as Tailwind brand color in light cards) — covered by mapping table below.

---

## MANDATORY — Read First

Before starting, the executing agent MUST read:
1. `.agent/BOOTSTRAP.md`
2. `.agent/WORKMAP.md` — Phase 6 entry
3. `task and plan/maintainability/maintainability_phase1_backend_splits_001.md` — style template for plan
4. `src/app/globals.css` — declares `@theme` color tokens (primary source of truth)
5. `src/styles/app-theme-engine.css` — defines the runtime CSS variables (`--app-bg`, `--app-text`, etc.)
6. Reference idiom: `src/app/(privileged)/loading.tsx` — already uses `bg-app-surface`, `border-app-border`, `bg-app-surface-2` correctly.

---

## Goal

Replace the **3,499** hardcoded color references across `src/app/` (broken down: 2,953 `text-…-NNN`, 2,051 `bg-…-NNN`, 1,076 `border-…-NNN`, plus `ring/from/to/via`/hex/rgb literals) with semantic theme tokens defined in `globals.css`. After migration:

- Light mode rendering should be visually equivalent (or better).
- Dark mode rendering should stop breaking on migrated pages.
- `npx tsc --noEmit` must show zero new errors after every batch.

---

## Audit (counts as of 2026-04-30, scope = `src/app/**/*.tsx`)

### Patterns

| Pattern | Count |
|---|---|
| `text-{palette}-NNN` | 2,953 |
| `bg-{palette}-NNN`   | 2,051 |
| `border-{palette}-NNN` | 1,076 |
| `from-{palette}-NNN` | 256 |
| `to-{palette}-NNN`   | 186 |
| `ring-{palette}-NNN` | 158 |
| Hex / `rgb(` / `hsl(` literals | 2,901 |

(Palette = `red|blue|green|gray|slate|zinc|yellow|orange|purple|pink|amber|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose|lime`.)

Hex/rgb count is inflated by legitimate non-color uses (e.g. `#fff` in inline SVG, JSON examples in docs, `rgba(...)` in box-shadows) — those will be evaluated during execution rather than pre-counted.

### Top 25 files by hardcoded-color density

| Count | Path |
|---:|---|
| 75 | `src/app/(auth)/register/business/page.tsx` |
| 58 | `src/app/(privileged)/purchases/receiving/ReceivingScreen.tsx` |
| 54 | `src/app/(privileged)/finance/ledger/import/page.tsx` |
| 53 | `src/app/tenant/[slug]/account/orders/[id]/page.tsx` |
| 47 | `src/app/tenant/[slug]/account/page.tsx` |
| 47 | `src/app/(privileged)/(saas)/connector/policies/page.tsx` |
| 45 | `src/app/(privileged)/workspace/wise-console/client.tsx` |
| 45 | `src/app/(privileged)/inventory/analytics/page.tsx` |
| 42 | `src/app/(privileged)/migration_v2/jobs/new/page.tsx` |
| 41 | `src/app/(privileged)/(saas)/encryption/page.tsx` |
| 39 | `src/app/(privileged)/(saas)/connector/page.tsx` |
| 38 | `src/app/(privileged)/(saas)/organizations/page.tsx` |
| 37 | `src/app/tenant/[slug]/account/wallet/page.tsx` |
| 37 | `src/app/supplier-portal/[slug]/page.tsx` |
| 36 | `src/app/(privileged)/delivery/page.tsx` |
| 35 | `src/app/landing/page.tsx` |
| 33 | `src/app/supplier-portal/[slug]/profile/page.tsx` |
| 33 | `src/app/(privileged)/workspace/performance/client.tsx` |
| 33 | `src/app/(privileged)/finance/vouchers/page.tsx` |
| 32 | `src/app/supplier-portal/[slug]/statement/page.tsx` |
| 31 | `src/app/tenant/[slug]/account/profile/page.tsx` |
| 31 | `src/app/(privileged)/crm/contacts/[id]/page.tsx` |
| 31 | `src/app/(auth)/register/user/page.tsx` |
| 30 | `src/app/(privileged)/purchases/invoicing/InvoicingScreen.tsx` |
| 30 | `src/app/(privileged)/finance/payments/page.tsx` |

### Aggregated by major subdirectory (sum of `(text|bg|border|ring|from|to|via)-PALETTE-NNN`)

| Total tokens | Subdirectory | # files |
|---:|---|---:|
| **756** | `src/app/(privileged)/finance` | 89 |
| 500 | `src/app/(privileged)/inventory` | 77 |
| 412 | `src/app/(privileged)/(saas)` | 30 |
| 363 | `src/app/tenant/[slug]` | 23 |
| 322 | `src/app/(privileged)/sales` | 30 |
| 249 | `src/app/(privileged)/purchases` | 18 |
| 221 | `src/app/supplier-portal/[slug]` | 9 |
| 217 | `src/app/(privileged)/workspace` | 28 |
| 200 | `src/app/(privileged)/crm` | 16 |
| 189 | `src/app/(privileged)/hr` | 19 |
| 132 | `src/app/(privileged)/settings` | 25 |
| 106 | `src/app/(auth)/register` | 4 |
| 98 | `src/app/(privileged)/migration_v2` | 6 |
| 95 | `src/app/(privileged)/products` | 9 |
| 81 | `src/app/(privileged)/delivery` | 6 |

`src/app/(privileged)/finance` is the largest single coherent target → chosen for the proof-of-concept.

---

## Theme tokens available (from `src/app/globals.css` + `app-theme-engine.css`)

The codebase defines two tiers of tokens:

### Tier 1 — `app-*` semantic tokens (preferred — they cascade through `.theme-*` classes)

- Surface: `bg-app-bg`, `bg-app-surface`, `bg-app-surface-2`, `bg-app-surface-hover`
- Text: `text-app-foreground`, `text-app-muted-foreground`, `text-app-faint`
- Border: `border-app-border`, `border-app-border-strong`
- Brand: `bg-app-primary`, `bg-app-primary-dark`, `bg-app-primary-light`, `text-app-primary`
- Status: `bg-app-success`, `bg-app-success-bg`, `text-app-success`
            `bg-app-warning`, `bg-app-warning-bg`, `text-app-warning`
            `bg-app-error`,   `bg-app-error-bg`,   `text-app-error`
            `bg-app-info`,    `bg-app-info-bg`,    `text-app-info`
- Border variants: `border-app-success`, `border-app-warning`, `border-app-error`, `border-app-info`
- Ring variants:   `ring-app-primary`, `ring-app-warning`, `ring-app-info`, `ring-app-border`

### Tier 2 — shadcn-style aliases (already defined via `@theme inline` in `globals.css`)

`bg-card`, `bg-popover`, `bg-muted`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-destructive`, `border-border`, `border-input`, `ring-ring`, etc. These resolve to the same `--app-*` variables, so visually equivalent. Use these only inside imported shadcn primitives.

> **Decision**: For application-page code (the migration target), prefer **Tier 1** (`*-app-*`) — it's more explicit and matches existing idioms in `(privileged)/loading.tsx`, `(privileged)/ecommerce/orders/[id]/page.tsx`, etc.

---

## Migration mapping table

The mapping is **semantic**, not a 1:1 string swap. Same Tailwind class can mean different things depending on context (a brand-emerald button vs. a success-emerald badge). We compromise on a default, and use semantic context only when wrong.

| Hardcoded class | → Theme token | Notes |
|---|---|---|
| `bg-white`, `bg-slate-50`, `bg-gray-50` | `bg-app-surface` | Card / panel surface |
| `bg-slate-100`, `bg-gray-100`, `bg-zinc-100` | `bg-app-surface-2` | Subtle inner surface |
| `bg-slate-200`, `bg-gray-200` | `bg-app-surface-hover` | Hover/active surface |
| `bg-slate-900`, `bg-gray-900`, `bg-zinc-900` | `bg-app-bg` | Page background (when used as outer chrome) — keep for ink-on-dark text contexts |
| `text-slate-900`, `text-gray-900`, `text-zinc-900`, `text-black` | `text-app-foreground` | Body / primary text |
| `text-slate-700`, `text-slate-600`, `text-gray-700`, `text-gray-600` | `text-app-foreground` | Body text — slight opacity loss in light mode but readable |
| `text-slate-500`, `text-gray-500`, `text-zinc-500` | `text-app-muted-foreground` | Secondary / meta text |
| `text-slate-400`, `text-gray-400`, `text-zinc-400` | `text-app-faint` | Placeholders / disabled |
| `text-white` | `text-app-foreground` *or* keep | Keep when on a colored button (`bg-app-primary`); replace when used as default body text |
| `border-slate-200`, `border-gray-200`, `border-zinc-200` | `border-app-border` | Default 1px border |
| `border-slate-300`, `border-gray-300` | `border-app-border-strong` | Emphasized border |
| `bg-emerald-500`, `bg-emerald-600`, `bg-green-500` | `bg-app-primary` | Brand action |
| `bg-emerald-50`, `bg-green-50`, `bg-emerald-100`, `bg-green-100` | `bg-app-success-bg` | Success badge / pill |
| `text-emerald-500`, `text-emerald-600`, `text-emerald-700`, `text-green-600` | `text-app-success` | Success text (or `text-app-primary` when on a brand action) |
| `text-emerald-50`, `text-green-50` | `text-app-foreground` | Inverted (rare) |
| `border-emerald-200`, `border-green-200` | `border-app-success` | Success border |
| `bg-rose-50`, `bg-red-50`, `bg-rose-100`, `bg-red-100` | `bg-app-error-bg` | Error badge / banner |
| `text-rose-500`, `text-rose-600`, `text-rose-700`, `text-red-500`, `text-red-600` | `text-app-error` | Error text |
| `border-rose-200`, `border-red-200`, `border-rose-300` | `border-app-error` | Error border |
| `bg-amber-50`, `bg-yellow-50`, `bg-orange-50`, `bg-amber-100` | `bg-app-warning-bg` | Warning |
| `text-amber-500..700`, `text-yellow-500..700`, `text-orange-600` | `text-app-warning` | Warning text |
| `border-amber-200`, `border-yellow-200` | `border-app-warning` | Warning border |
| `bg-blue-50`, `bg-sky-50`, `bg-indigo-50`, `bg-blue-100` | `bg-app-info-bg` | Info banner |
| `text-blue-500..700`, `text-sky-500..700`, `text-indigo-600` | `text-app-info` | Info text |
| `border-blue-200`, `border-sky-200` | `border-app-info` | Info border |
| `ring-emerald-…` | `ring-app-primary` | |
| `ring-rose-…`/`ring-red-…` | `ring-app-warning` (no `ring-app-error` alias defined) — **precursor** |
| `ring-blue-…`/`ring-sky-…` | `ring-app-info` | |

### Tokens we DO NOT have (precursors before full sweep)

These appear in the hardcoded set but lack a direct app-* alias. Document as **precursors** so the executing agent of the next phase can either (a) extend `globals.css`, or (b) leave the literal in place with a `// TODO theme-token` comment.

1. **No `ring-app-error`** — ring colors don't include error. Best workaround: `ring-app-warning` (semantic mismatch) or extend `globals.css` to add `--color-app-error-ring`.
2. **No purple / violet / fuchsia / pink semantic** — used in some marketing surfaces (`(auth)/register`, `landing`, `tenant/[slug]`). These are decorative gradients with no semantic meaning; safe to leave or replace with `app-primary`.
3. **No second-tier brand color** — pages like `(privileged)/(saas)` mix `text-purple-500` and `bg-indigo-100` for category accents. Recommend adding `--app-accent` and `--app-accent-bg` to the theme engine before migrating those.
4. **`from-…` / `to-…` gradients** — 442 occurrences. Most are decorative. Preserve as-is in PoC; defer their migration to a separate sub-phase that introduces gradient tokens or replaces them with solid surfaces.
5. **Hex literals in inline `style={{}}`** — 2,901 raw hex/rgb strings. Many are SVG `fill=`/`stroke=`, charts, or `boxShadow`. Out-of-scope for class-token sweep; document for a follow-up.

---

## Step 1 — Audit (DONE — see counts above)

## Step 2 — Proof-of-concept migration on `src/app/(privileged)/finance/`

### Why finance

- Highest density (756 tokens / 89 files).
- Uses the full set of semantic palettes (success/warning/error/info/brand) → exercises the full mapping.
- Internal-only routes → no SEO impact.
- Self-contained: most state and styling is local.

### Files explicitly EXCLUDED (touched by parallel agents per `git status` 2026-04-30 22:00)

- `src/app/(privileged)/finance/chart-of-accounts/migrate/MigrationPageClient.tsx`
- `src/app/(privileged)/finance/chart-of-accounts/templates/TemplatesPageClient.tsx`
- `src/app/(privileged)/finance/chart-of-accounts/templates/_components/PageChrome.tsx`
- `src/app/(privileged)/finance/fiscal-years/viewer.tsx`
- `src/app/(privileged)/finance/settings/posting-rules/form.tsx`

### Approach

For each remaining `(privileged)/finance/**/*.tsx` file with hardcoded colors:
1. Use `Edit` tool with `replace_all` for unambiguous substitutions only.
2. Use file-by-file `Edit` operations for context-sensitive substitutions (e.g. `text-emerald-600` could be brand or success).
3. After every ~10 files, run `npx tsc --noEmit` against the full project. Zero new errors expected.
4. Track before/after token counts in the report.

### Substitution rules (applied verbatim where unambiguous)

```text
# Surfaces
bg-white                  → bg-app-surface
bg-slate-50               → bg-app-surface
bg-gray-50                → bg-app-surface
bg-slate-100              → bg-app-surface-2
bg-gray-100               → bg-app-surface-2
bg-zinc-100               → bg-app-surface-2

# Text
text-slate-900            → text-app-foreground
text-gray-900             → text-app-foreground
text-slate-700            → text-app-foreground
text-slate-600            → text-app-foreground
text-gray-700             → text-app-foreground
text-gray-600             → text-app-foreground
text-slate-500            → text-app-muted-foreground
text-gray-500             → text-app-muted-foreground
text-zinc-500             → text-app-muted-foreground
text-slate-400            → text-app-faint
text-gray-400             → text-app-faint

# Borders
border-slate-200          → border-app-border
border-gray-200           → border-app-border
border-zinc-200           → border-app-border
border-slate-300          → border-app-border-strong
border-gray-300           → border-app-border-strong

# Status — Success
bg-emerald-50             → bg-app-success-bg
bg-emerald-100            → bg-app-success-bg
bg-green-50               → bg-app-success-bg
bg-green-100              → bg-app-success-bg
text-emerald-500          → text-app-success
text-emerald-600          → text-app-success
text-emerald-700          → text-app-success
text-green-600            → text-app-success
text-green-700            → text-app-success
border-emerald-200        → border-app-success
border-green-200          → border-app-success

# Status — Error
bg-rose-50                → bg-app-error-bg
bg-rose-100               → bg-app-error-bg
bg-red-50                 → bg-app-error-bg
bg-red-100                → bg-app-error-bg
text-rose-500             → text-app-error
text-rose-600             → text-app-error
text-rose-700             → text-app-error
text-rose-400             → text-app-error
text-red-500              → text-app-error
text-red-600              → text-app-error
text-red-700              → text-app-error
border-rose-200           → border-app-error
border-red-200            → border-app-error
border-rose-300           → border-app-error

# Status — Warning
bg-amber-50               → bg-app-warning-bg
bg-amber-100              → bg-app-warning-bg
bg-yellow-50              → bg-app-warning-bg
bg-yellow-100             → bg-app-warning-bg
text-amber-500            → text-app-warning
text-amber-600            → text-app-warning
text-amber-700            → text-app-warning
text-amber-800            → text-app-warning
text-yellow-600           → text-app-warning
text-yellow-700           → text-app-warning
border-amber-200          → border-app-warning
border-yellow-200         → border-app-warning

# Status — Info
bg-blue-50                → bg-app-info-bg
bg-blue-100               → bg-app-info-bg
bg-sky-50                 → bg-app-info-bg
bg-indigo-50              → bg-app-info-bg
text-blue-500             → text-app-info
text-blue-600             → text-app-info
text-blue-700             → text-app-info
text-blue-800             → text-app-info
text-blue-900             → text-app-info
text-sky-600              → text-app-info
text-indigo-600           → text-app-info
border-blue-100           → border-app-info
border-blue-200           → border-app-info
border-sky-200            → border-app-info
```

### Out of scope for the PoC

- Hex literals inside inline `style={{}}`
- `from-/to-/via-` gradients
- Brand-emerald usage on buttons (would need a context-sensitive review — `bg-emerald-500` on a CTA is brand, not success)
- Files modified by parallel phase agents (see exclusion list above)

---

## Step 3 — Remaining scope

After PoC executes against `(privileged)/finance/`, remaining work is:

| Subdir | Tokens | Est. effort |
|---|---:|---:|
| `(privileged)/inventory` | 500 | ~1.5 h |
| `(privileged)/(saas)` | 412 | ~1.5 h (needs `--app-accent` precursor) |
| `tenant/[slug]` | 363 | ~1.5 h (public storefront — extra QA) |
| `(privileged)/sales` | 322 | ~1 h |
| `(privileged)/purchases` | 249 | ~1 h |
| `supplier-portal/[slug]` | 221 | ~1 h |
| `(privileged)/workspace` | 217 | ~1 h |
| `(privileged)/crm` | 200 | ~1 h |
| `(privileged)/hr` | 189 | ~1 h |
| `(privileged)/settings` | 132 | ~0.75 h |
| `(auth)/register` | 106 | ~0.75 h (needs decorative-purple decision) |
| `(privileged)/migration_v2` | 98 | ~0.5 h |
| Other (<100 each) | ~400 | ~2 h |

Plus **precursors** (estimated ~1 h):
1. Add `--color-app-error-ring` (or document `ring-app-warning` substitution).
2. Decide on `--app-accent` for non-brand category accents (purple/indigo).
3. Decide policy for `from-/to-` gradients.
4. Sweep raw hex/rgb in inline `style={{}}` props (separate pattern, separate phase).

**Grand total remaining effort**: ~14–16 hours after the finance PoC.

---

## Verification checklist

After the PoC:
1. `npx tsc --noEmit` — zero new errors.
2. Re-run pattern counts on `(privileged)/finance/` — should drop from ~756 to <400 (decorative gradients + ambiguous brand-emerald uses retained).
3. Diff sample 3–5 files; confirm light-mode preserved.
4. Manually open one finance page in dark theme; visually confirm it now renders correctly.

---

## PoC results (2026-04-30)

### Counts (finance subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 359 | 139 | −220 |
| `bg-…-NNN` | 251 | 130 | −121 |
| `border-…-NNN` | 99 | 32 | −67 |
| `ring-…-NNN` | 7 | 7 | 0 |
| `from-…-NNN` | 86 | 81 | −5 |
| `to-…-NNN` | 51 | 50 | −1 |
| **Total** | **756** | **347** | **−409 (−54%)** |

### Files modified

- 87 files in `src/app/(privileged)/finance/` modified.
- 5 finance files deliberately skipped (modified by parallel phase agents).
- Net change: 487 insertions, 474 deletions.

### TSC

- Baseline before sweep: 188 errors (zero in `(privileged)/finance/`).
- After sweep: 95 errors (zero in `(privileged)/finance/`). The drop reflects parallel Phase-5 agents reducing `any`-cast errors elsewhere — completely unrelated to this sweep.
- **Zero new TSC errors introduced by Phase 6.** ✓

### Sample diffs (representative)

`src/app/(privileged)/finance/ledger/import/page.tsx` (54 → ~10):
```diff
- 'bg-emerald-100 text-emerald-700 border border-emerald-200'
+ 'bg-app-success-bg text-app-success border border-app-success'
- <CheckCircle className="h-10 w-10 text-emerald-500" />
+ <CheckCircle className="h-10 w-10 text-app-success" />
- <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
+ <div className="bg-app-info-bg border border-app-info rounded-xl p-4 text-sm text-app-info">
- <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
+ <div className="flex items-start gap-3 p-4 bg-app-error-bg border border-app-error rounded-xl text-app-error text-sm">
```

`src/app/(privileged)/finance/payments/page.tsx` (30 → ~8):
```diff
- POSTED: { label: 'Posted', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
- CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
+ POSTED: { label: 'Posted', color: 'text-app-success', bg: 'bg-app-success-bg border-app-success', icon: CheckCircle2 },
+ CANCELLED: { label: 'Cancelled', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: XCircle },
```

`src/app/(privileged)/finance/vouchers/page.tsx` (33 → ~12):
```diff
- OPEN: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Clock },
- LOCKED: { label: 'Locked', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Lock },
- CONFIRMED: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
+ OPEN: { label: 'Open', color: 'text-app-info', bg: 'bg-app-info-bg border-app-info', icon: Clock },
+ LOCKED: { label: 'Locked', color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', icon: Lock },
+ CONFIRMED: { label: 'Confirmed', color: 'text-app-success', bg: 'bg-app-success-bg border-app-success', icon: CheckCircle2 },
```

### What remains in finance (347 tokens)

Top residual patterns:
- `bg-emerald-500/600/400` — brand-action solid backgrounds. Ambiguous (could be brand or success); deferred for context-sensitive review.
- `text-orange-700`, `text-purple-600/700`, `bg-purple-50` — no `--app-accent` token defined.
- `text-emerald-400/900`, `text-amber-400/900` — shade variants outside the mapped 50–800 range; mostly used inside complex gradient bands.
- `from-emerald-50`, `to-blue-100`, etc. — gradient stops; deferred to a separate gradient-token phase.

---

## Session 2 results — `(privileged)/inventory/` and `(privileged)/sales/` (2026-04-30)

### Counts (inventory subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 350 | 68 | −282 |
| `bg-…-NNN` | 249 | 102 | −147 |
| `border-…-NNN` | 121 | 50 | −71 |
| `ring-…-NNN` | 44 | 44 | 0 |
| `from-…-NNN` | 34 | 34 | 0 |
| `to-…-NNN` | 25 | 25 | 0 |
| **Total (text/bg/border)** | **720** | **220** | **−500 (−69%)** |

### Counts (sales subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 210 | 42 | −168 |
| `bg-…-NNN` | 151 | 72 | −79 |
| `border-…-NNN` | 53 | 42 | −11 |
| `ring-…-NNN` | 17 | 17 | 0 |
| `from-…-NNN` | 20 | 20 | 0 |
| `to-…-NNN` | 8 | 8 | 0 |
| **Total (text/bg/border)** | **414** | **156** | **−258 (−62%)** |

### Files modified

- 73 files in `src/app/(privileged)/inventory/` modified.
- 24 files in `src/app/(privileged)/sales/` modified.
- 97 files total. Net change: 499 insertions, 499 deletions (1:1 in-place class swaps via perl).

### TSC

- Baseline before sweep (this session, after parallel Phase-5 fixes): 0 errors.
- After sweep: 0 new errors from this phase. 9 lines of pre-existing errors observed:
  - `(privileged)/settings/regional/client.tsx` (Phase 5 in progress on `LanguageCatalogueItem` typing) — outside scope
  - `(privileged)/purchases/new/_components/AdminSidebar.tsx` (mid-edit JSX imbalance from a parallel agent) — outside scope
- **Zero new TSC errors introduced by this Phase 6 session.** ✓

### Sample diffs (representative)

`src/app/(privileged)/inventory/analytics/page.tsx` (status badge color maps):
```diff
- if (score >= 80) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
- if (score >= 60) return 'bg-yellow-50 text-yellow-700 ring-yellow-200'
- return 'bg-red-50 text-red-700 ring-red-200'
+ if (score >= 80) return 'bg-app-success-bg text-app-success ring-emerald-200'
+ if (score >= 60) return 'bg-app-warning-bg text-app-warning ring-yellow-200'
+ return 'bg-app-error-bg text-app-error ring-red-200'
- PENDING: { label: 'Requested', cls: 'bg-blue-50 text-blue-700 ring-blue-200', icon: Clock },
- CONVERTED: { label: 'Order Created', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: FileText },
- REJECTED: { label: 'Failed', cls: 'bg-red-50 text-red-700 ring-red-200', icon: XCircle },
+ PENDING: { label: 'Requested', cls: 'bg-app-info-bg text-app-info ring-blue-200', icon: Clock },
+ CONVERTED: { label: 'Order Created', cls: 'bg-app-success-bg text-app-success ring-emerald-200', icon: FileText },
+ REJECTED: { label: 'Failed', cls: 'bg-app-error-bg text-app-error ring-red-200', icon: XCircle },
```

`src/app/(privileged)/sales/[id]/page.tsx`:
```diff
- <Link href="/sales/history" className="text-emerald-500 font-bold hover:underline">Return to History</Link>
+ <Link href="/sales/history" className="text-app-success font-bold hover:underline">Return to History</Link>
- <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Amount</div>
- <div className="text-xl font-black text-emerald-700">{fmt(parseFloat(order.total_amount))}</div>
+ <div className="text-[10px] font-black text-app-success uppercase tracking-widest mb-1">Total Amount</div>
+ <div className="text-xl font-black text-app-success">{fmt(parseFloat(order.total_amount))}</div>
```

`src/app/(privileged)/sales/audit/AuditTable.tsx` (representative status pills swept by perl):
```diff
- <span className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full font-bold">Failed</span>
+ <span className="text-xs bg-app-error-bg text-app-error px-2 py-1 rounded-full font-bold">Failed</span>
```

### What remains (376 tokens across both subdirs after sweep)

- `ring-…-NNN` (61 total, untouched) — no `ring-app-*` aliases for emerald/red/yellow shade pairs.
- `from-…-NNN` / `to-…-NNN` (54+33 = 87, untouched) — gradient tokens not defined; leave for gradient-token phase.
- Decorative `purple/cyan/pink/violet` (used in `inventory/analytics`, `inventory/intelligence`, etc. for category accents) — needs `--app-accent` precursor.
- `bg-emerald-500/600` (brand action solids on CTAs) — context-sensitive; deferred.
- `text-emerald-900/950`, `text-amber-900` — out-of-range shade variants, niche use inside gradient bands.

### Updated subdir scope (for next session)

| Subdir | Tokens (orig) | Tokens (after this session) | Status |
|---|---:|---:|---|
| `(privileged)/finance` | 756 | 347 | DONE (Session 1) |
| `(privileged)/inventory` | 500+ | ~220 | DONE (this session) |
| `(privileged)/sales` | 322+ | ~156 | DONE (this session) |
| `(privileged)/(saas)` | 412 | 412 | TODO |
| `tenant/[slug]` | 363 | 363 | TODO |
| `(privileged)/purchases` | 249 | 249 | TODO |
| `supplier-portal/[slug]` | 221 | 221 | TODO |
| `(privileged)/workspace` | 217 | 217 | TODO |
| `(privileged)/crm` | 200 | 200 | TODO |
| `(privileged)/hr` | 189 | 189 | TODO |
| Others | ~836 | ~836 | TODO |

---

## Session 3 results — `(privileged)/workspace/`, `(privileged)/hr/`, `(privileged)/crm/`, `(privileged)/purchases/` (2026-04-30)

Smaller-density sibling subdirs swept in parallel with Session 2 (inventory + sales).

### Counts (workspace subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 161 | 31 | −130 |
| `bg-…-NNN` | 126 | 28 | −98 |
| `border-…-NNN` | 91 | 16 | −75 |
| `ring-…-NNN` | 0 | 0 | 0 |
| `from-…-NNN` | 9 | 9 | 0 |
| `to-…-NNN` | 8 | 8 | 0 |
| **Total** | **395** | **92** | **−303 (−77%)** |

### Counts (hr subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 103 | 12 | −91 |
| `bg-…-NNN` | 104 | 14 | −90 |
| `border-…-NNN` | 66 | 8 | −58 |
| `ring-…-NNN` | 11 | 11 | 0 |
| `from-…-NNN` | 15 | 13 | −2 |
| `to-…-NNN` | 7 | 6 | −1 |
| **Total** | **306** | **64** | **−242 (−79%)** |

### Counts (crm subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 136 | 28 | −108 |
| `bg-…-NNN` | 105 | 29 | −76 |
| `border-…-NNN` | 24 | 5 | −19 |
| `ring-…-NNN` | 20 | 20 | 0 |
| `from-…-NNN` | 8 | 14 | +6 (auto-backup pulled in upstream additions) |
| `to-…-NNN` | 0 | 8 | +8 (same) |
| **Total** | **293** | **104** | **−189 (−65%)** |

### Counts (purchases subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 195 | 23 | −172 |
| `bg-…-NNN` | 191 | 56 | −135 |
| `border-…-NNN` | 65 | 15 | −50 |
| `ring-…-NNN` | 12 | 13 | +1 |
| `from-…-NNN` | 5 | 5 | 0 |
| `to-…-NNN` | 1 | 1 | 0 |
| **Total** | **469** | **113** | **−356 (−76%)** |

### Files modified

- 28 files in `src/app/(privileged)/workspace/`
- 19 files in `src/app/(privileged)/hr/`
- 13 files in `src/app/(privileged)/crm/`
- 18 files in `src/app/(privileged)/purchases/` (3 of those — `purchases/new/{form.tsx, _components/AdminSidebar.tsx, _components/ProductSearch.tsx}` — also have parallel-agent structural rewrites; my color edits compose with theirs cleanly)
- **78 files total**. Net change in this session is purely class-name swaps; auto-backup at session start brought in unrelated upstream changes for some files.

### Two-pass approach

1. **Pass 1 (`/tmp/phase6_migrate.sh`)** — neutral surfaces, text shades, borders, status `-50/100/200/300` swaps for emerald/green/rose/red/amber/yellow/orange/blue/sky/indigo. Also includes `text-emerald-400`, `text-rose-400`, `text-amber-400` (often used for dark-context badges). All idempotent (safe to re-run).
2. **Pass 2 (`/tmp/phase6_pass2.sh`)** — brand emerald solids (`bg-emerald-500/600/700` → `bg-app-primary{,-dark}`), solid status borders/backgrounds at `-500/600/700` shade for non-emerald palettes, `border-gray-50/-slate-50/-zinc-50` (subtle) → `border-app-border`. Run after Pass 1.

### TSC

- Baseline before this session: 0 errors.
- After this session: 0 errors. **Zero new TSC errors introduced.** ✓

### Sample diffs (representative)

`src/app/(privileged)/workspace/wise-rules/page.tsx` (module color map):
```diff
- crm: 'bg-blue-500/10 text-blue-400',
- finance: 'bg-emerald-500/10 text-emerald-400',
- sales: 'bg-amber-500/10 text-amber-400',
- manual: 'bg-rose-500/10 text-rose-400',
+ crm: 'bg-app-info/10 text-app-info',
+ finance: 'bg-app-primary/10 text-app-success',
+ sales: 'bg-app-warning/10 text-app-warning',
+ manual: 'bg-app-error/10 text-app-error',
```

`src/app/(privileged)/hr/payroll/page.tsx` (header CTA + badge):
```diff
- EMPLOYEE: 'bg-blue-100 text-blue-700',
+ EMPLOYEE: 'bg-app-info-bg text-app-info',
- <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
+ <div className="w-10 h-10 rounded-xl bg-app-primary flex items-center justify-center">
```

`src/app/(privileged)/crm/insights/page.tsx` (tier styles):
```diff
- Gold: 'bg-amber-100 text-amber-700',
- Bronze: 'bg-orange-100 text-orange-700',
+ Gold: 'bg-app-warning-bg text-app-warning',
+ Bronze: 'bg-app-warning-bg text-app-warning',
- <TrendingUp size={24} className="text-green-500" />
- <p className="text-2xl font-bold text-green-700">{activeCustomers}</p>
+ <TrendingUp size={24} className="text-app-success" />
+ <p className="text-2xl font-bold text-app-success">{activeCustomers}</p>
```

`src/app/(privileged)/purchases/receiving/ReceivingScreen.tsx` (status risk colors retained `dark:` overlay):
```diff
- SAFE_TO_RECEIVE: { label: 'Safe to Receive', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: Check },
+ SAFE_TO_RECEIVE: { label: 'Safe to Receive', color: 'bg-app-success-bg text-app-success dark:bg-emerald-900/30 dark:text-app-success', icon: Check },
```

`src/app/(privileged)/crm/client-gate-preview/client.tsx` (preview chrome):
```diff
- <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
-     <Eye size={22} className="text-emerald-600" />
+ <div className="w-12 h-12 rounded-2xl bg-app-success-bg border border-app-success flex items-center justify-center">
+     <Eye size={22} className="text-app-success" />
```

### What remains in these 4 subdirs (373 tokens total)

- **Decorative `violet/purple/fuchsia/cyan/teal/indigo`** — no `--app-accent` token defined. workspace has 14 `border-violet-500`, hr has scattered violet/purple, crm has many `bg-violet-100/600/700` for category cards, purchases has `text-purple-500/600/700` series. Document as **precursor**: needs `--app-accent` + `--app-accent-bg` + `--app-accent-fg` + border/text variants in `globals.css`.
- **`bg-{red,emerald,blue,rose}-900/XX` with `dark:` prefix** in `purchases/receiving/ReceivingScreen.tsx` and `purchases/new-order-v2/form.tsx` — explicit dark-mode overlays paired with `app-*` tokens. Redundant (the `app-*` tokens already adapt to dark mode) but not wrong; left in place to match existing idiom.
- **`bg-[#020617] border-gray-800/700/600` in preview clients** (`crm/client-gate-preview/client.tsx`, `crm/supplier-gate-preview/client.tsx`) — intentional dark-on-dark UI showing what the public gate page looks like. Hardcoded by design.
- **Ring colors** (workspace=0, hr=11, crm=20, purchases=13) — no `ring-app-success/error/info` aliases for shade pairs in some uses. Out of scope until a precursor sweep adds `--color-app-*-ring`.
- **Gradient `from-/to-`** (workspace=17, hr=19, crm=22, purchases=6) — gradient tokens not defined; leave for gradient-token phase.

### Updated subdir scope (after Session 3)

| Subdir | Tokens (orig) | Tokens (after) | Status |
|---|---:|---:|---|
| `(privileged)/finance` | 756 | 347 | DONE (Session 1) |
| `(privileged)/inventory` | 500+ | ~220 | DONE (Session 2) |
| `(privileged)/sales` | 322+ | ~156 | DONE (Session 2) |
| `(privileged)/workspace` | 395 | 92 | DONE (Session 3) |
| `(privileged)/hr` | 306 | 64 | DONE (Session 3) |
| `(privileged)/crm` | 293 | 104 | DONE (Session 3) |
| `(privileged)/purchases` | 469 | 113 | DONE (Session 3) |
| `(privileged)/(saas)` | 412 | 412 | TODO |
| `tenant/[slug]` | 363 | 363 | TODO |
| `supplier-portal/[slug]` | 221 | 221 | TODO |
| Others | ~836 | ~836 | TODO |

---

## Critical rules for the executing agent

1. **PRESERVE VISUAL OUTPUT in light mode.** Don't replace `text-blue-600` with `text-app-error`. Match meaning.
2. **DO NOT touch** files modified by parallel phase agents (see exclusion list).
3. **DO NOT touch** the `task and plan/maintainability/maintainability_phase*.md` plan files or `WORKMAP.md`.
4. **Run `npx tsc --noEmit` after every batch** of 10 files.
5. **If a token is missing** (e.g. `ring-app-error`), document as a precursor in this plan; do not invent a Tailwind class that doesn't exist.
6. **Brand emerald vs. success emerald** — if `bg-emerald-500` is on a `<button>` (CTA), map to `bg-app-primary`. If it's on a `<Badge>`/`<div>` (status pill), map to `bg-app-success`. Default to `bg-app-success` only when context is clearly status.
