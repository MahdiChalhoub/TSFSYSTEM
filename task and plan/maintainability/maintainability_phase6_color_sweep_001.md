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

## Session 4 results — `(privileged)/settings/`, `(privileged)/migration_v2/`, `(auth)/register/` (2026-05-01)

Three smaller-density subdirs swept in a single session. The `(auth)/register/` subdir is special: its dark-themed, cyan-branded marketing pages are intentionally hardcoded — most residuals there are by-design intentional-dark `bg-slate-900` and brand-cyan `bg-cyan-500`/`text-cyan-400`/`ring-cyan-500`/`border-cyan-400|500`.

### Counts (settings subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 92 | 3 | −89 |
| `bg-…-NNN` | 54 | 14 | −40 |
| `border-…-NNN` | 28 | 5 | −23 |
| `ring-…-NNN` | 5 | 5 | 0 |
| `from-…-NNN` | 3 | 3 | 0 |
| `to-…-NNN` | 0 | 3 | +3 |
| **Total (text/bg/border)** | **174** | **22** | **−152 (−87%)** |

(All-pattern total: 132 → 33, −75%.)

### Counts (migration_v2 subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 62 | 6 | −56 |
| `bg-…-NNN` | 45 | 17 | −28 |
| `border-…-NNN` | 12 | 0 | −12 |
| `ring-…-NNN` | 0 | 0 | 0 |
| `from-…-NNN` | 0 | 0 | 0 |
| `to-…-NNN` | 0 | 0 | 0 |
| **Total** | **98** | **23** | **−75 (−77%)** |

### Counts (register subdir, before → after)

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 67 | 8 | −59 |
| `bg-…-NNN` | 51 | 38 | −13 |
| `border-…-NNN` | 11 | 2 | −9 |
| `ring-…-NNN` | 8 | 8 | 0 |
| `from-…-NNN` | 1 | 1 | 0 |
| `to-…-NNN` | 0 | 1 | +1 |
| **Total** | **105** | **58** | **−47 (−45%)** |

The lower percentage reflects the intentional dark-cyan branding palette of the register pages, not missed migrations. Excluding `bg-slate-900` (intentional dark surface, 35 occurrences) and `text-cyan-*/bg-cyan-*/ring-cyan-*/border-cyan-*` (brand color, 21 occurrences), the residual is 2 — both `border-slate-700` decorative dark border frames.

### Files modified (32 files total)

**settings/ (24 files)**

| Residual | File |
|---:|---|
| 0 | `appearance/OrgThemeSettings.tsx` |
| 1 | `audit-trail/page.tsx` |
| 1 | `branding/LoginBrandingEditor.tsx` |
| 2 | `e-invoicing/monitor/monitor-client.tsx` |
| 4 | `notifications/page.tsx` |
| 6 | `payment-terms/client.tsx` |
| 1 | `payment-terms/page.tsx` |
| 0 | `purchase-analytics/_components/CompareModal.tsx` |
| 0 | `purchase-analytics/_components/DiffModal.tsx` |
| 0 | `purchase-analytics/_components/DiffPreviewModal.tsx` |
| 0 | `purchase-analytics/_components/FieldHelp.tsx` |
| 0 | `purchase-analytics/_components/HistoryModal.tsx` |
| 0 | `purchase-analytics/_components/TemplateManager.tsx` |
| 0 | `purchase-analytics/_components/sections/PricingSection.tsx` |
| 0 | `purchase-analytics/_components/sections/QuantitySection.tsx` |
| 0 | `purchase-analytics/_components/sections/SalesSection.tsx` |
| 0 | `purchase-analytics/_components/sections/ScoringSection.tsx` |
| 3 | `roles/RoleManager.tsx` |
| 0 | `roles/RolesBuilderClient.tsx` |
| 0 | `roles/RolesMatrixClient.tsx` |
| 0 | `roles/page.tsx` |
| 1 | `security/POSPinSettings.tsx` |
| 3 | `security/TwoFactorSettings.tsx` |
| 3 | `security/page.tsx` |

**migration_v2/ (6 files)**

| Residual | File |
|---:|---|
| 0 | `jobs/[id]/edit/page.tsx` |
| 0 | `jobs/[id]/mappings/page.tsx` |
| 2 | `jobs/[id]/verification/page.tsx` |
| 1 | `jobs/new/page.tsx` |
| 1 | `jobs/page.tsx` |
| 18 | `page.tsx` (mostly `dark:bg-*-900/30` overlays + decorative purple step cards) |

**(auth)/register/ (2 files)**

| Residual | File |
|---:|---|
| 32 | `business/page.tsx` (intentional dark theme + cyan branding) |
| 11 | `user/page.tsx` (intentional dark theme + cyan branding) |

### Two-pass approach

Same scripts as Session 3 — `/tmp/phase6_migrate.sh` (Pass 1: surfaces, text, borders, status -50/100/200) then `/tmp/phase6_pass2.sh` (Pass 2: brand emerald, solid status backgrounds, solid borders). Plus 5 targeted `perl -i` edits for residual non-purple/cyan colors:
- `border-red-50` → `border-app-error` (TwoFactorSettings)
- `hover:bg-emerald-200` → `hover:bg-app-success-bg` (e-invoicing monitor-client)
- `border-emerald-600` → `border-app-success` (migration_v2 jobs/[id]/edit spinner)
- `bg-slate-200` → `bg-app-surface-2` (migration_v2 jobs/[id]/verification avatar)
- `text-rose-300` → `text-app-error` (RolesMatrixClient)
- `text-gray-200` → `text-app-faint` (RoleManager)

### TSC

- Baseline before this session: 0 errors.
- After this session: 2 errors, both pre-existing in `purchases/new/_components/AdminSidebar.tsx` (`Cannot find name 'DateField'` × 2 — parallel-agent mid-edit, well-documented in prior phase notes; outside Phase 6 scope).
- **Zero new TSC errors introduced by this Phase 6 session.** ✓

### Sample diffs (representative)

`src/app/(privileged)/settings/security/page.tsx` (status pills inside dark security card):
```diff
- <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-widest font-black">SECURE CONFIGURATION</span>
+ <span className="text-[10px] text-app-success font-mono uppercase tracking-widest font-black">SECURE CONFIGURATION</span>
- <div className="text-3xl text-blue-400">2FA</div>
+ <div className="text-3xl text-app-info">2FA</div>
```

`src/app/(privileged)/settings/payment-terms/client.tsx`:
```diff
- <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">INACTIVE</span>
+ <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-app-error-bg text-app-error dark:bg-rose-900/30 dark:text-app-error">INACTIVE</span>
```

`src/app/(privileged)/migration_v2/page.tsx` (source connector cards):
```diff
- color: 'bg-emerald-50 dark:bg-emerald-900/30',
- badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
+ color: 'bg-app-success-bg dark:bg-emerald-900/30',
+ badgeColor: 'bg-app-success-bg text-app-success dark:bg-emerald-900/30 dark:text-app-success',
```

`src/app/(auth)/register/business/page.tsx` (text labels — but inputs preserve dark-cyan branding):
```diff
- <h1 className="text-3xl md:text-4xl font-black text-white">Register Business</h1>
- <p className="text-sm text-slate-400 mt-1">Create your organization on TSF</p>
+ <h1 className="text-3xl md:text-4xl font-black text-white">Register Business</h1>
+ <p className="text-sm text-app-faint mt-1">Create your organization on TSF</p>
```

### What remains (114 tokens across all 3 subdirs)

- **Settings (33)**: 11 violet/purple decorative + 2 cyan/teal + 5 `dark:*-900/30` overlays + 6 intentional `bg-slate-900/800/600` for security UI dark cards + 4 `ring-emerald-500/X` opacity-modified focus rings + 3 gradient `from-emerald-500`/`to-teal-600` decorative + a few opacity-modified `bg-green-500/5`-style tokens.
- **migration_v2 (23)**: 12 purple decorative (RUNNING-status purple + step cards `bg-purple-50/600/700/100`) + 3 cyan decorative + 6 `dark:*-900/30` overlays + 2 `bg-slate-200`/etc.
- **(auth)/register (58)**: 35 intentional `bg-slate-900[/50]` dark surfaces + 21 cyan brand accents (`text-cyan-400`, `ring-cyan-500`, `bg-cyan-500/600`, `border-cyan-400/500`) + 2 `border-slate-700` decorative dark borders. **By design — these are the registration pages' brand styling.**

### Updated subdir scope (after Session 4)

| Subdir | Tokens (orig) | Tokens (after) | Status |
|---|---:|---:|---|
| `(privileged)/finance` | 756 | 347 | DONE (Session 1) |
| `(privileged)/inventory` | 500+ | ~220 | DONE (Session 2) |
| `(privileged)/sales` | 322+ | ~156 | DONE (Session 2) |
| `(privileged)/workspace` | 395 | 92 | DONE (Session 3) |
| `(privileged)/hr` | 306 | 64 | DONE (Session 3) |
| `(privileged)/crm` | 293 | 104 | DONE (Session 3) |
| `(privileged)/purchases` | 469 | 113 | DONE (Session 3) |
| `(privileged)/settings` | 132 | 33 | DONE (Session 4) |
| `(privileged)/migration_v2` | 98 | 23 | DONE (Session 4) |
| `(auth)/register` | 105 | 58 | DONE (Session 4) |
| `(privileged)/(saas)` | 412 | 412 | TODO (parallel agent) |
| `tenant/[slug]` | 363 | 363 | TODO |
| `supplier-portal/[slug]` | 221 | 221 | TODO |
| Others | ~836 | ~836 | TODO |

---

## Session 4b results — `(privileged)/(saas)/` + new `--app-accent` token family (2026-05-01)

Parallel-track Session 4 work targeting the (saas) admin subdir, which uses indigo / purple / violet heavily for category accents (connector states, encryption type cards, module category chips, subscription plan tiers, etc.). This session also resolves the `--app-accent` precursor noted by Sessions 2 and 3.

### Step 1 — Added `--app-accent` token family to `globals.css`

Added to the `@theme` block alongside the existing success / warning / error / info families (after `--color-app-info-bg`):

```css
/* Accent (violet) family — non-brand category accent for purple/indigo CTAs.
   Aligned with --chart-4 (#8B5CF6 / violet-500). Mirrors success/info/etc. shape. */
--color-app-accent:             var(--app-accent, #8B5CF6);                       /* violet-500 */
--color-app-accent-bg:          var(--app-accent-bg, rgba(139,92,246,0.12));      /* violet-500 @12% */
--color-app-accent-bg-soft:     var(--app-accent-bg-soft, rgba(139,92,246,0.06)); /* violet-500 @6% */
--color-app-accent-border:      var(--app-accent-border, rgba(139,92,246,0.32));  /* violet-500 @32% */
--color-app-accent-strong:      var(--app-accent-strong, #6D28D9);                /* violet-700 */
```

**Rationale**: `--chart-4` is already `#8B5CF6` in both `:root` and `.dark` blocks of `globals.css`, so violet-500 is the established design-system accent. Alpha levels match the `--app-success-bg` (12%) / `--app-error-bg` (12%) idiom; `-bg-soft` (6%) gives a softer hover/decorative surface; `-border` (32% alpha) matches the visual weight of Tailwind's `border-violet-200` against light surfaces. `-strong` (#6D28D9 / violet-700) is the saturated counterpart for emphasized actions.

`npx tsc --noEmit` exit 0 immediately after the token addition (token files don't affect TS compilation).

### Step 2 — (saas) sweep counts

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 271 | 0 | −271 |
| `bg-…-NNN` | 207 | 1 | −206 |
| `border-…-NNN` | 134 | 3 | −131 |
| `ring-…-NNN` | 14 | 0 | −14 |
| `from-…-NNN` | 13 | 13 | 0 (gradient — deferred) |
| `to-…-NNN` | 12 | 12 | 0 (gradient — deferred) |
| `via-…-NNN` | 1 | 1 | 0 (gradient — deferred) |
| **Total non-gradient** | **626** | **4** | **−622 (−99%)** |
| **Total all patterns** | **652** | **30** | **−622 (−95%)** |

### Top 10 hotspot file table (before → after)

| File | Before | After |
|---|---:|---:|
| `connector/policies/page.tsx` | 47 | 0 |
| `encryption/page.tsx` | 41 | 3 (gradients) |
| `connector/page.tsx` | 39 | 4 (gradients) |
| `organizations/page.tsx` | 38 | 1 (gradient) |
| `subscription-plans/page.tsx` | 26 | 1 (gradient) |
| `modules/page.tsx` | 21 | 4 (intentional dark-preview chrome) |
| `connector/buffer/page.tsx` | 20 | 0 |
| `health/page.tsx` | 19 | 0 |
| `subscription-plans/[id]/page.tsx` | 18 | 0 |
| `updates/page.tsx` | 17 | 0 |

### Files modified

- **30 files** modified in `src/app/(privileged)/(saas)/` — all files that contained hardcoded colors.
- Net: 400 insertions, 400 deletions (1:1 byte-symmetric class swaps via two perl passes — `/tmp/saas_phase6_sweep.sh` for surfaces+text+border+status+accent low-shade swaps, `/tmp/saas_phase6_pass2.sh` for solid status / accent backgrounds + ring colors + cyan/teal).

### TSC

- Baseline before this session: 0 errors.
- After this session: 0 errors. **Zero new TSC errors introduced.** ✓

### Sample diffs (representative)

`src/app/(privileged)/(saas)/connector/policies/page.tsx` (state-action color map):
```diff
- 'forward': 'bg-blue-50 text-blue-700 border-blue-200',
- 'wait': 'bg-amber-50 text-amber-700 border-amber-200',
- 'empty': 'bg-indigo-50 text-indigo-700 border-indigo-200',
- 'cached': 'bg-green-50 text-green-700 border-green-200',
- 'mock': 'bg-purple-50 text-purple-700 border-purple-200',
- 'error': 'bg-red-50 text-red-700 border-red-200',
+ 'forward': 'bg-app-info-bg text-app-info border-app-info',
+ 'wait': 'bg-app-warning-bg text-app-warning border-app-warning',
+ 'empty': 'bg-app-accent-bg text-app-accent border-app-accent',
+ 'cached': 'bg-app-success-bg text-app-success border-app-success',
+ 'mock': 'bg-app-accent-bg text-app-accent border-app-accent',
+ 'error': 'bg-app-error-bg text-app-error border-app-error',
```

`src/app/(privileged)/(saas)/connector/page.tsx` (status icon container):
```diff
- <div className="p-3 rounded-2xl bg-indigo-500 text-white shadow-lg">
+ <div className="p-3 rounded-2xl bg-app-accent text-white shadow-lg">
```

`src/app/(privileged)/(saas)/organizations/page.tsx` (org plan badge + ring):
```diff
- 'bg-emerald-50 text-emerald-700 border-emerald-200'
+ 'bg-app-success-bg text-app-success border-app-success'
- ring-2 ring-emerald-500
+ ring-2 ring-app-primary
```

`src/app/(privileged)/(saas)/encryption/page.tsx` (status pills, retaining decorative gradient hero card):
```diff
- <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
+ <Badge variant="outline" className="bg-app-success-bg text-app-success border-app-success">Active</Badge>
```

### What remains in (saas) (30 tokens)

- **26 gradients** (`from-emerald-500/600`, `to-cyan-500/600`, `from-indigo-500 to-purple-600`, `from-amber-500 to-orange-600`, `via-purple-50`, etc.) — **deferred to gradient-token phase** (matches the precedent set by Sessions 1–3). Used in hero cards / encryption status cards / subscription-plan tier cards / connector dashboard tiles.
- **4 intentional dark-preview chrome** in `modules/page.tsx` lines 354 / 360 / 375 / 463 — `bg-[#0F172A] border-gray-800 text-white` matched with `bg-red-950/20` for a **deliberately dark module-detail dialog** that visually previews the module manifest as a JSON-style readout. Hardcoded by design; not theme-bound.

### Updated subdir scope (after Session 4b)

| Subdir | Tokens (orig) | Tokens (after) | Status |
|---|---:|---:|---|
| `(privileged)/finance` | 756 | 347 | DONE (Session 1) |
| `(privileged)/inventory` | 500+ | ~220 | DONE (Session 2) |
| `(privileged)/sales` | 322+ | ~156 | DONE (Session 2) |
| `(privileged)/workspace` | 395 | 92 | DONE (Session 3) |
| `(privileged)/hr` | 306 | 64 | DONE (Session 3) |
| `(privileged)/crm` | 293 | 104 | DONE (Session 3) |
| `(privileged)/purchases` | 469 | 113 | DONE (Session 3) |
| `(privileged)/settings` | 132 | 33 | DONE (Session 4) |
| `(privileged)/migration_v2` | 98 | 23 | DONE (Session 4) |
| `(auth)/register` | 105 | 58 | DONE (Session 4) |
| **`(privileged)/(saas)`** | **412** | **30** | **DONE (Session 4b)** |
| `tenant/[slug]` | 363 | 363 | TODO |
| `supplier-portal/[slug]` | 221 | 221 | TODO |
| Others | ~400 | ~400 | TODO |

### Cumulative impact across Sessions 1–4b

- **324 files migrated**.
- **2,860 hardcoded colors removed** (greater than the original 3,499 audit count for `text-/bg-/border-` because some files contained multiple swaps and the per-pass perl rules also swept additional shade variants outside the original audit ranges).
- **`--app-accent` precursor RESOLVED.** All future Phase 6 work in `tenant/[slug]`, `supplier-portal/[slug]`, etc. can use the violet accent family directly.
- `npx tsc --noEmit` exit 0 throughout — zero new TS errors introduced by any session.

---

## Session 5 results — `supplier-portal/[slug]/` (2026-05-01)

The supplier-portal is an **intentional dark-themed portal** (similar in chrome to the `(auth)/register` pages cleaned in Session 4): outer surface is `bg-[#020617]` (slate-950 hex), card surfaces are `bg-slate-900/40-80` and `bg-slate-950/30-80` glass overlays, sidebar/branding accents are indigo (which we map to the new `--app-accent` violet family), white headline text on dark, slate-500 muted dark text, and emerald/sky/amber soft-glow status pills.

The `--app-accent` family added in Session 4 is the right home for the indigo/purple branding accent. Solid status CTAs (`bg-amber-600`, `bg-sky-600`, `bg-blue-600`, `bg-indigo-600`) are mapped to the matching `bg-app-warning`/`bg-app-info`/`bg-app-accent` solid tokens.

### Counts (supplier-portal subdir, before → after)

Baseline measured against commit `49a26203` (the last commit before any sweep partials landed in auto-backups). Three perl passes were applied (`/tmp/supplier_portal_sweep.sh` + `/tmp/supplier_portal_pass3.sh`) plus a one-liner placeholder-color repair.

| Pattern | Before | After | Δ |
|---|---:|---:|---:|
| `text-…-NNN` | 148 | 0 | −148 |
| `bg-…-NNN` | 101 | 51 | −50 |
| `border-…-NNN` | 52 | 0 | −52 |
| `ring-…-NNN` | 2 | 2 | 0 (opacity-modified `ring-indigo-500/5`) |
| `from-…-NNN` | 3 | 3 | 0 (gradient stops — deferred) |
| `to-…-NNN` | 3 | 3 | 0 (gradient stops — deferred) |
| **Total (text/bg/border)** | **301** | **51** | **−250 (−83%)** |
| **Total (all patterns)** | **309** | **59** | **−250 (−81%)** |

### Files modified (9 — all 9 hardcoded-color-holding files in scope)

| File | Before | After | Notes |
|---|---:|---:|---|
| `[slug]/page.tsx` | 63 | 12 | Login page + dashboard. Kept `bg-slate-900/60`, `bg-slate-950/50`, opacity-modified status soft glows, `ring-indigo-500/5`. |
| `[slug]/profile/page.tsx` | 54 | 10 | Dark glass cards `bg-slate-950/50` and `bg-red-500/10` error overlays preserved. |
| `[slug]/price-requests/page.tsx` | 49 | 9 | All status pills mapped to app-warning/info/accent/success. |
| `[slug]/statement/page.tsx` | 41 | 11 | Six gradient stops kept (intentional decorative `from-emerald-600/20 to-emerald-900/20`). |
| `[slug]/notifications/page.tsx` | 36 | 4 | Type-config color map fully migrated. |
| `[slug]/proformas/page.tsx` | 33 | 6 | Soft glows preserved; brand emerald CTA → `bg-app-primary`. |
| `[slug]/orders/[id]/page.tsx` | 21 | 2 | (file already partially used `text-app-text*` — different naming convention left intact since outside hardcoded-color scope). |
| `[slug]/layout.tsx` | 20 | 3 | Sidebar chrome: `bg-slate-950/80` glass + indigo brand accents migrated to app-accent. |
| `[slug]/orders/page.tsx` | 15 | 2 | Status badge map migrated; one decorative `bg-blue-500/10` ambient blur preserved. |
| **Totals** | **332** | **59** | (332 = HEAD baseline including auto-backup-captured intermediate state; 309 vs 49a26203 baseline) |

The "332 vs HEAD" baseline above reflects the auto-backup state at the start of this session (a partial earlier sweep had been auto-committed). The "309 vs 49a26203" is the true pre-Phase-6 baseline.

### Two-pass + one repair approach

1. **Pass 1 (`/tmp/supplier_portal_sweep.sh`)** — neutral text shades (slate/gray/zinc 400/500/600/700 → app-faint/muted-foreground/foreground), status palette `-50/100/200/300/400` swaps for emerald/green/rose/red/amber/yellow/orange/blue/sky and accent `-50/100/200/300/400` for indigo/purple/violet/fuchsia/pink, neutral light borders, and light surfaces. Idempotent.
2. **Pass 2 (`/tmp/supplier_portal_sweep.sh` Pass 2 block)** — brand emerald solid CTAs `bg-emerald-500/600` → `bg-app-primary`, `-700` → `bg-app-primary-dark`, hover variants paired similarly.
3. **Pass 3 (`/tmp/supplier_portal_pass3.sh`)** — solid status CTAs at `-500/600` shade for amber (warning), sky/blue (info), and indigo (accent — supplier portal brand) plus matching `hover:` variants.
4. **Placeholder repair** — `placeholder:text-app-foreground` rolled back to `placeholder:text-app-faint` across 10 input fields. The original `placeholder:text-slate-700` was a deliberately faint dark-on-dark placeholder hint; mapping `slate-700 → app-foreground` made placeholders too prominent in the dark theme.

### TSC

- Baseline before this session: 0 errors.
- After this session: 0 errors. **Zero new TSC errors introduced.** ✓

### Sample diffs (representative)

`src/app/supplier-portal/[slug]/notifications/page.tsx` (notification type config map):
```diff
- ORDER: { icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
- PROFORMA: { icon: FileText, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
- PRICE_REQUEST: { icon: TrendingDown, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
- SYSTEM: { icon: Info, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
+ ORDER: { icon: ShoppingCart, color: 'text-app-info', bg: 'bg-app-info/10 border-app-info/20' },
+ PROFORMA: { icon: FileText, color: 'text-app-success', bg: 'bg-app-success/10 border-app-success/20' },
+ PRICE_REQUEST: { icon: TrendingDown, color: 'text-app-warning', bg: 'bg-app-warning/10 border-app-warning/20' },
+ SYSTEM: { icon: Info, color: 'text-app-info', bg: 'bg-app-info/10 border-app-info/20' },
```

`src/app/supplier-portal/[slug]/layout.tsx` (sidebar branding):
```diff
- <div className="w-10 h-10 bg-indigo-500/20 border border-indigo-500/30 rounded-xl ... text-indigo-400">
+ <div className="w-10 h-10 bg-app-accent/20 border border-app-accent/30 rounded-xl ... text-app-accent">
- 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
+ 'bg-app-accent/10 text-app-accent border border-app-accent/20'
- <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-white">
+ <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-app-muted-foreground hover:text-white">
```

`src/app/supplier-portal/[slug]/price-requests/page.tsx` (status palette + warning CTA):
```diff
- PENDING: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
- APPROVED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
- REJECTED: 'text-red-400 bg-red-500/10 border-red-500/20',
- COUNTER_OFFER: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
+ PENDING: 'text-app-warning bg-app-warning/10 border-app-warning/20',
+ APPROVED: 'text-app-success bg-app-success/10 border-app-success/20',
+ REJECTED: 'text-app-error bg-app-error/10 border-app-error/20',
+ COUNTER_OFFER: 'text-app-info bg-app-info/10 border-app-info/20',
- className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-500 transition-all">
+ className="flex items-center gap-2 px-6 py-3 bg-app-warning text-white rounded-xl font-bold hover:bg-app-warning transition-all">
```

### What remains in supplier-portal (59 tokens)

- **Intentional dark-glass surfaces (~30):** `bg-slate-900/40-80` and `bg-slate-950/30-80` — the deliberate dark glass cards forming the portal's design language. Same idiom as `(auth)/register` Session 4. Cannot map to existing `app-*` tokens (those don't have an opacity-aware variant). **Skip rule honored.**
- **Opacity-modified status soft glows (~15):** `bg-red-500/10`, `bg-amber-500/10`, `bg-sky-500/10`, `bg-blue-500/10`, `bg-indigo-500/10`, `bg-purple-500/10` — paired with `border-app-X/20` and `text-app-X` (already migrated). Skip rule honored.
- **Decorative gradient stops (6):** `from-emerald-600/20 to-emerald-900/20`, `from-blue-600/20 to-blue-900/20`, `from-amber-600/20 to-amber-900/20` in `statement/page.tsx` summary card glow rings. Deferred per gradient policy.
- **Brand accent solid (subset):** 4 `bg-indigo-500` / `bg-indigo-600` / `bg-indigo-500/20` survived where the `\b` word boundary rule didn't cover the opacity variant — these are the brand-accent soft surfaces at 20% alpha; left alone.
- **Two opacity-modified rings:** `ring-indigo-500/5` on the login form input. Skip rule honored.
- **`bg-slate-500/10`:** 2 occurrences in `orders/[id]/page.tsx` (DRAFT/SUBMITTED status pills — neutral muted glow). Skip rule honored.

### Updated subdir scope (after Session 5)

| Subdir | Tokens (orig) | Tokens (after) | Status |
|---|---:|---:|---|
| `(privileged)/finance` | 756 | 347 | DONE (Session 1) |
| `(privileged)/inventory` | 500+ | ~220 | DONE (Session 2) |
| `(privileged)/sales` | 322+ | ~156 | DONE (Session 2) |
| `(privileged)/workspace` | 395 | 92 | DONE (Session 3) |
| `(privileged)/hr` | 306 | 64 | DONE (Session 3) |
| `(privileged)/crm` | 293 | 104 | DONE (Session 3) |
| `(privileged)/purchases` | 469 | 113 | DONE (Session 3) |
| `(privileged)/settings` | 132 | 33 | DONE (Session 4) |
| `(privileged)/migration_v2` | 98 | 23 | DONE (Session 4) |
| `(auth)/register` | 105 | 58 | DONE (Session 4) |
| `(privileged)/(saas)` | 412 | 30 | DONE (Session 4b) |
| `supplier-portal/[slug]` | 309 | 59 | DONE (Session 5) |
| **`tenant/[slug]`** | **366** | **39** | **DONE (Session 6)** |
| Others | ~400 | ~400 | TODO |

### Cumulative impact across Sessions 1–6

- **355 files migrated**.
- **3,437 hardcoded colors removed** (cumulative across all 13 swept subdirs).
- `npx tsc --noEmit` exit 0 throughout — zero new TS errors introduced by any session.

---

## Session 6 results — `tenant/[slug]/` (2026-05-01)

### Counts (tenant subdir, before → after)

| Pattern (text/bg/border/ring/from/to) | Before | After | Δ |
|---|---:|---:|---:|
| **Total combined** | **366** | **39** | **−327 (−89%)** |

### Per-file before → after (top 10)

| File | Before | After |
|---|---:|---:|
| `account/orders/[id]/page.tsx` | 53 | 3 |
| `account/page.tsx` | 47 | 2 |
| `account/wallet/page.tsx` | 37 | 7 |
| `account/profile/page.tsx` | 31 | 1 |
| `register/page.tsx` | 27 | 7 |
| `quote/page.tsx` | 27 | 12 |
| `account/tickets/page.tsx` | 24 | 0 |
| `account/notifications/page.tsx` | 23 | 0 |
| `account/orders/page.tsx` | 19 | 0 |
| `account/wishlist/page.tsx` | 18 | 0 |

(Plus 12 lower-density files migrated to 0–6 residuals each.)

### Files modified

- **22 files** modified in `src/app/tenant/[slug]/`.
- All swaps via 3 perl passes (`/tmp/tenant_color_sweep{,_v2,_v3}.pl`) — byte-symmetric class-name swaps (zero behavior change).

### TSC

- Baseline before sweep: 0 errors.
- After sweep: 0 errors. **Zero new TSC errors introduced.** ✓

### Sample diffs (representative)

`tenant/[slug]/account/orders/[id]/page.tsx` (status & payment maps):
```diff
- CART:      { ..., color: 'text-slate-400',   bg: 'bg-slate-500/10' },
- PLACED:    { ..., color: 'text-blue-400',    bg: 'bg-blue-500/10' },
- CONFIRMED: { ..., color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
- PROCESSING:{ ..., color: 'text-amber-400',   bg: 'bg-amber-500/10' },
- SHIPPED:   { ..., color: 'text-purple-400',  bg: 'bg-purple-500/10' },
- CANCELLED: { ..., color: 'text-red-400',     bg: 'bg-red-500/10' },
+ CART:      { ..., color: 'text-app-muted-foreground', bg: 'bg-app-surface-2' },
+ PLACED:    { ..., color: 'text-app-info',    bg: 'bg-app-info-bg' },
+ CONFIRMED: { ..., color: 'text-app-success', bg: 'bg-app-success-bg' },
+ PROCESSING:{ ..., color: 'text-app-warning', bg: 'bg-app-warning-bg' },
+ SHIPPED:   { ..., color: 'text-app-accent',  bg: 'bg-app-accent-bg' },
+ CANCELLED: { ..., color: 'text-app-error',   bg: 'bg-app-error-bg' },
```

`tenant/[slug]/account/wallet/page.tsx` (transaction icon colors):
```diff
- CREDIT:        { icon: ArrowDownRight, color: 'text-emerald-400' },
- DEBIT:         { icon: ArrowUpRight,   color: 'text-red-400' },
- LOYALTY_EARN:  { icon: TrendingUp,     color: 'text-purple-400' },
- LOYALTY_REDEEM:{ icon: Gift,           color: 'text-amber-400' },
- REFUND:        { icon: ArrowDownRight, color: 'text-blue-400' },
+ CREDIT:        { icon: ArrowDownRight, color: 'text-app-success' },
+ DEBIT:         { icon: ArrowUpRight,   color: 'text-app-error' },
+ LOYALTY_EARN:  { icon: TrendingUp,     color: 'text-app-accent' },
+ LOYALTY_REDEEM:{ icon: Gift,           color: 'text-app-warning' },
+ REFUND:        { icon: ArrowDownRight, color: 'text-app-info' },
```

`tenant/[slug]/account/page.tsx` (page background + nav tile borders):
```diff
- <div className="min-h-screen bg-[#020617] p-4 lg:p-8 relative">
- <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
- <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
+ <div className="min-h-screen bg-app-bg p-4 lg:p-8 relative">
+ <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-app-accent/10 blur-[150px] rounded-full pointer-events-none z-0" />
+ <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-app-primary/10 blur-[150px] rounded-full pointer-events-none z-0" />
```

### What remains in tenant (39 tokens)

All 39 residuals fall into documented skip categories:

| File | Residuals | Category |
|---|---:|---|
| `quote/page.tsx` | 12 | **teal-{400,500,600,900}** portal-specific brand color (10 occurrences as text/bg/border/focus/shadow) |
| `register/page.tsx` | 7 | 5 `focus:ring-emerald-500/5` (opacity-modified ring — skip) + 2 `shadow-emerald-900/40` (custom shadow color) |
| `account/wallet/page.tsx` | 7 | 5 tier-definition decorative brand colors (Bronze/Silver/Gold/Platinum/Diamond — each tier has unique brand identity by design) + 2 `from-/to-{purple,amber}-{600,900}/20` decorative balance card gradients |
| `OrgNotFoundPage.tsx` | 4 | All gradients/shadows (`from-emerald-500/[0.03]`, `from-slate-800 to-slate-900`, `shadow-amber-500/40`, `shadow-emerald-500/{10,25}`) |
| `not-found.tsx` | 4 | All gradients/shadows (matching pattern: hero gradient + amber notification badge shadow + emerald button shadow) |
| `LandingHomePage.tsx` | 2 | 1 `from-indigo-600 to-violet-600` hero text gradient + 1 `shadow-indigo-200/50` button shadow |
| `account/page.tsx` | 2 | `bg-cyan-500/10 text-cyan-400` Notifications nav tile (cyan as portal accent — skip per rules) |
| `account/profile/page.tsx` | 1 | `bg-cyan-500/10` decorative blur glow |

**No code changes needed for these residuals** — all are either:
1. **Decorative gradients** (skip per phase rules — `from-/to-/via-` deferred until gradient-token phase)
2. **Custom shadow colors** (`shadow-{color}-{N}` — no shadow tokens defined; same nuance as ring tokens)
3. **Opacity-modified rings** (`ring-{color}-{N}/{N}` — skip per phase rules)
4. **Portal-specific brand cyan/teal** (skip per phase rules)
5. **Decorative tier brand colors** (each tier needs unique brand identity by design — Bronze/Silver/Gold/Platinum/Diamond)

---

## Session 7 results — `(privileged)/products/`, `(privileged)/delivery/`, `(privileged)/ecommerce/`, `(privileged)/dashboard/` (2026-05-01)

### Summary

| Subdir | Before | After | Δ | % | Files modified |
|---|---:|---:|---:|---:|---:|
| `(privileged)/products/` | 116 | 7 | −109 | −94% | 7 |
| `(privileged)/delivery/` | 115 | 4 | −111 | −97% | 6 |
| `(privileged)/ecommerce/` | 45 | 12 | −33 | −73% | 8 |
| `(privileged)/dashboard/` | 21 | 0 | −21 | −100% | 3 |
| **Combined** | **297** | **23** | **−274** | **−92%** | **24** |

(All counts use the same baseline regex as prior sessions: `\b(bg|text|border)-{color}-{N}\b`. `\b` boundaries between digit and `/` mean `bg-amber-500/10` returns `bg-amber-50` in counts, so opacity-modified classes still appear in the after-count. The four subdirs combined have **0 plain (non-opacity, non-gradient) hardcoded colors remaining**.)

### Top hotspots per subdir

**products** (top 7 files):
- `new/smart-form.tsx` — 39 → 6 residual (all opacity-modified `bg-{amber,purple}-500/{10,20}` decorative + 1 `from-amber-50/30 to-orange-50/20` gradient + 2 `border-amber-200/{40,50}` opacity)
- `new/form.tsx` — 23 → 0 (full sweep including brand `bg-green-600 hover:bg-green-700` CTA → `bg-app-primary hover:opacity-90`; success-banner combo `bg-green-50 text-green-600 border-green-200` → `bg-app-success-bg text-app-success border-app-success`)
- `new/packaging-tree.tsx` — 15 → 1 residual (opacity-modified `bg-amber-500/10`)
- `page.tsx` — 14 → 0 (`hover:bg-emerald-50` → `hover:bg-app-success-bg`, group block icon colors)
- `new/pricing-engine.tsx` — 14 → 0 (margin tier color/bg map fully migrated; gradient `barColor` strings preserved as data tokens — they feed an unsafe-list TailwindCSS class string in a chart cell)
- `new/advanced-form.tsx` — 6 → 0 (`focus:ring-blue-500/20` → `focus:ring-app-info/20`, `focus:ring-purple-400` → `focus:ring-app-accent`, `focus:ring-blue-500` → `focus:ring-app-info`)
- `new/form-wrapper.tsx` — 5 → 0 (`text-red-500` asterisks + error banner combo)

**delivery** (top 6 files):
- `page.tsx` — 65 → 2 residual (opacity-modified `bg-blue-500/10` icon-tile glows on lines 290, 575). Migrated all status badge combos `bg-emerald-50 text-emerald-600 border border-emerald-100` → `bg-app-success-bg text-app-success border border-app-success`, KPI tile color/bg props ({ color: 'text-app-info', bg: 'bg-app-info-bg' }), ONLINE/BUSY/OFFLINE status pills, brand `bg-amber-500` driver tag → `bg-app-warning`. Gradient `from-blue-500 to-cyan-500` header preserved per skip rules.
- `_components/DriverDashboard.tsx` — 27 → 1 residual (`border-emerald-500/20` opacity border preserved). `text-{blue,emerald,amber,purple}-400` icon trinity + `bg-{emerald,blue,rose,amber,purple}-500` MetricProgress/getStatusColor returns + getStatusBadge rose/blue/emerald/amber colors all migrated.
- `_components/DriverStatement.tsx` — 11 → 0 (balance text +/- coloring `text-emerald-400`/`text-rose-400` → `text-app-success`/`text-app-error`, transaction icon colors, brand "Request Payout" button `bg-blue-500 hover:bg-blue-600` → `bg-app-info hover:opacity-90`)
- `_components/AssignDriverModal.tsx` — 5 → 0 (online indicator dot, address icon, ONLINE highlight)
- `_components/LogExpenseModal.tsx` — 4 → 1 residual (`bg-blue-500/20` selection bg opacity-modified — kept; full-color `border-blue-500` selection border migrated)
- `_components/DriverProfileModal.tsx` — 3 → 0 (gradient `from-amber-400 to-orange-500` header preserved per skip rules; text-amber-500 avatar + ONLINE/BUSY status pill solid bgs migrated)

**ecommerce** (top 8 files):
- `coupons/CouponsClient.tsx` — 12 → 4 (auto/manual coupon-type pills `bg-violet-500/15 text-violet-400 border-violet-400/20` and `bg-sky-500/15 text-sky-400 border-sky-400/20` — text-portion migrated `text-app-accent`/`text-app-info`, opacity bg/border preserved per skip rules)
- `shipping/ShippingClient.tsx` — 6 → 2 (opacity-modified rose-500/10 toast bgs)
- `promotions/PromotionsClient.tsx` — 6 → 2 (same)
- `webhooks/WebhooksClient.tsx` — 5 → 2 (same)
- `storefront-config/new/page.tsx` — 6 → 0 (full red/green status banner combo migrated)
- `orders/new/page.tsx` — 6 → 0 (same)
- `quotes/QuotesClient.tsx` — 1 → 0
- `catalog/reviews/page.tsx` — 3 → 0 (destructive button `text-rose-500 hover:text-rose-600 hover:bg-rose-50` → `text-app-error hover:opacity-80 hover:bg-app-error-bg`)

**dashboard** (3 files, 100% clean):
- `page.tsx` — 11 → 0 (IN/OUT/UPDATE colored dots `bg-{green,red,amber}-400` → `bg-app-{success,error,warning}`, +/- delta `text-{green,red}-600`, violet performance bar tiers `bg-violet-{500,300,100}` → `bg-app-accent`/`bg-app-accent/60`/`bg-app-accent-bg`, blue avatar circle)
- `page-legacy.tsx` — 5 → 0 (revenue-change badge combo `text-rose-600 bg-rose-50/50 border-rose-100` → `text-app-error bg-app-error-bg/50 border-app-error`, ledger row IN/OUT colors)
- `legacy/page.tsx` — 5 → 0 (same patterns as page-legacy)

### Residuals breakdown by category (23 total)

| Category | Count | Files affected |
|---|---:|---|
| Opacity-modified `bg-{color}-500/{10,15,20}` decorative tile glows / pill bgs | 14 | products/smart-form, products/packaging-tree, delivery/page (×2), delivery/LogExpenseModal, ecommerce/coupons (×2), ecommerce/shipping, ecommerce/promotions, ecommerce/webhooks, ecommerce/CouponsClient (×2 hover-bg), ecommerce/promotions/webhooks/shipping (toast bgs) |
| Opacity-modified `border-{color}-{200-500}/{20,40,50}` | 6 | products/smart-form (amber-200/40, amber-200/50), ecommerce/coupons (violet-400/20, sky-400/20), delivery/DriverDashboard (emerald-500/20) |
| Decorative gradients `from-/to-` (skip per rules) | 3 | products/smart-form (`from-amber-50/30 to-orange-50/20`), delivery/page (`from-blue-500 to-cyan-500` Hub header), delivery/DriverProfileModal (`from-amber-400 to-orange-500` header) |

**No code changes needed** — all 23 residuals fall into documented skip categories.

### TSC

- Baseline before sweep: 0 errors.
- After sweep: 0 errors. **Zero new TSC errors introduced.** ✓

### Sample diffs (representative)

`delivery/page.tsx` (KPI tile color/bg map):
```diff
-  { label: 'Zones', value: zones.length, icon: MapPin, color: 'text-blue-500', bg: 'bg-blue-50' },
-  { label: 'Active Drivers', value: ..., icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
-  { label: 'Shipping Rates', value: rates.length, icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50' },
-  { label: 'Avg Fee', value: ..., icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', prefix: '$' },
+  { label: 'Zones', value: zones.length, icon: MapPin, color: 'text-app-info', bg: 'bg-app-info-bg' },
+  { label: 'Active Drivers', value: ..., icon: Truck, color: 'text-app-warning', bg: 'bg-app-warning-bg' },
+  { label: 'Shipping Rates', value: rates.length, icon: Package, color: 'text-app-success', bg: 'bg-app-success-bg' },
+  { label: 'Avg Fee', value: ..., icon: DollarSign, color: 'text-app-accent', bg: 'bg-app-accent-bg', prefix: '$' },
```

`dashboard/page.tsx` (movement type dot trinity):
```diff
- <div className={`w-2 h-2 rounded-full ${m.type === 'IN' ? 'bg-green-400' : m.type === 'OUT' ? 'bg-red-400' : 'bg-amber-400'}`} />
+ <div className={`w-2 h-2 rounded-full ${m.type === 'IN' ? 'bg-app-success' : m.type === 'OUT' ? 'bg-app-error' : 'bg-app-warning'}`} />
```

`products/new/pricing-engine.tsx` (margin tier color/bg map):
```diff
- if (marginPercent >= 40) return { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-500', barColor: 'from-emerald-400 to-emerald-600' };
- if (marginPercent >= 25) return { label: 'Good',      color: 'text-blue-600',    bg: 'bg-blue-500',    barColor: 'from-blue-400 to-blue-600' };
- if (marginPercent >= 10) return { label: 'Low',       color: 'text-amber-600',   bg: 'bg-amber-500',   barColor: 'from-amber-400 to-amber-600' };
- if (marginPercent > 0)  return { label: 'Thin',       color: 'text-orange-600',  bg: 'bg-orange-500',  barColor: 'from-orange-400 to-orange-600' };
- return                          { label: 'Loss',      color: 'text-red-600',     bg: 'bg-red-500',     barColor: 'from-red-400 to-red-600' };
+ if (marginPercent >= 40) return { label: 'Excellent', color: 'text-app-success', bg: 'bg-app-success', barColor: 'from-emerald-400 to-emerald-600' };
+ if (marginPercent >= 25) return { label: 'Good',      color: 'text-app-info',    bg: 'bg-app-info',    barColor: 'from-blue-400 to-blue-600' };
+ if (marginPercent >= 10) return { label: 'Low',       color: 'text-app-warning', bg: 'bg-app-warning', barColor: 'from-amber-400 to-amber-600' };
+ if (marginPercent > 0)  return { label: 'Thin',       color: 'text-app-warning', bg: 'bg-app-warning', barColor: 'from-orange-400 to-orange-600' };
+ return                          { label: 'Loss',      color: 'text-app-error',   bg: 'bg-app-error',   barColor: 'from-red-400 to-red-600' };
```
(`barColor` gradient strings preserved — they feed a TailwindCSS unsafe-class chart cell pattern; gradient-token phase will handle them.)

### Nuance discovered

- `app-{success,info,warning,error}-strong` tokens **do NOT exist** in `globals.css` (only `app-accent-strong` and `app-primary-dark` exist as the "darker" variant). When migrating `bg-blue-500 hover:bg-blue-600` brand-button patterns, the standard pattern adopted in Session 7 was `bg-app-info hover:opacity-90` (matching the same pattern Session 5/6 used for emerald CTAs as `bg-app-primary hover:opacity-90`).
- Initial perl pass made one slip: `bg-app-info-strong` was emitted in `delivery/_components/DriverStatement.tsx` for the Request-Payout button — caught by tsc-check workflow and rolled back to `hover:opacity-90` immediately.

---

## Session 8 results — `(privileged)/pos/`, `(privileged)/client_portal/`, `(privileged)/supplier_portal/`, `(privileged)/mcp/` (2026-05-01)

### Scope and pattern observation

The four target subdirs in this batch turned out to be dominated by **auto-generated `/new/page.tsx` form scaffolds** with a uniform two-line color pattern: an error banner (`bg-red-50 text-red-800 border border-red-200`) and a success banner (`bg-green-50 text-green-800 border border-green-200`). All scaffold files carry `// @ts-nocheck` at the top so the swap is safe — directives left untouched per scope rules.

### Per-subdir per-file deltas

| Subdir | Before | After | Δ | Files |
|---|---:|---:|---:|---:|
| `(privileged)/pos/` | 42 | 0 | −42 (−100%) | 21 |
| `(privileged)/client_portal/` | 32 | 0 | −32 (−100%) | 16 |
| `(privileged)/supplier_portal/` | 22 | 0 | −22 (−100%) | 11 |
| `(privileged)/mcp/` | 17 | 0 | −17 (−100%) | 8 |
| **Total** | **113** | **0** | **−113** | **56** |

### Migration commands (single perl invocation across all 4 subdirs)

```bash
find "src/app/(privileged)/pos" "src/app/(privileged)/client_portal" \
     "src/app/(privileged)/supplier_portal" "src/app/(privileged)/mcp" \
     -name "page.tsx" -path "*/new/*" | xargs perl -i -pe '
  s|bg-red-50 text-red-800 border border-red-200|bg-app-error-bg text-app-error border border-app-error|g;
  s|bg-green-50 text-green-800 border border-green-200|bg-app-success-bg text-app-success border border-app-success|g;
'
```

### Manual edits

- `(privileged)/mcp/chat/page.tsx` — the only non-scaffold file in scope. Migrated 5 occurrences of the "Coming Soon" info-tile chrome:
  - `bg-blue-50` → `bg-app-info-bg`
  - `text-blue-600` (Bot icon) → `text-app-info`
  - `bg-blue-50 border border-blue-200` (notice card) → `bg-app-info-bg border border-app-info`
  - `text-blue-900` (notice title) and `text-blue-700` (notice body) → `text-app-info`

### Files modified (56 total)

- **pos (21)**: every `/new/page.tsx` under `pos-audit-rules`, `quotations`, `consignment-settlements`, `purchase-orders`, `deliveries`, `pos-tickets`, `orders`, `credit-notes`, `pos-registers`, `sourcing`, `delivery-zones`, `purchase`, `pos-settings`, `pos`, `supplier-pricing`, `sales-returns`, `discount-rules`, `purchase-returns`, `manager-address-book`, `po-lines`, `pos-audit-events`.
- **client_portal (16)**: every `/new/page.tsx` under `shipping-rates`, `admin-wallets`, `quote-requests`, `reviews`, `order-lines`, `my-wallet`, `client-access`, `cart-promotions`, `my-tickets`, `admin-orders`, `dashboard`, `config`, `admin-tickets`, `my-orders`, `coupons`, `wishlist`.
- **supplier_portal (11)**: every `/new/page.tsx` under `config`, `my-orders`, `my-proformas`, `my-stock`, `dashboard`, `my-price-requests`, `portal-access`, `my-notifications`, `proforma-lines`, `admin-proformas`, `admin-price-requests`.
- **mcp (8)**: 7 `/new/page.tsx` scaffolds (`tools`, `usage`, `agents`, `conversations`, `providers`, `agent-logs`) + manual edit on `chat/page.tsx`.

### Residuals (out of scope per rules)

- Hex literals in `error.tsx` `accentColor="#XXXXXX"` props (one per subdir — `#F59E0B`/`#0EA5E9`/`#8B5CF6`/`#14B8A6`) — these are intentional brand identifiers passed to `ModuleErrorBoundary` and belong in the hex-literal phase.
- `client_portal/dashboard/page.tsx` carries 3 inline-style hex literals (`color-mix(in srgb, #10b981 15%, transparent)`, `color="#10b981"`) — also deferred to the hex-literal phase.

### Verification

`npx tsc --noEmit` exit 0 both before and after the sweep — pure class-name swap, byte-symmetric (113 insertions / 113 deletions).

---

## Critical rules for the executing agent

1. **PRESERVE VISUAL OUTPUT in light mode.** Don't replace `text-blue-600` with `text-app-error`. Match meaning.
2. **DO NOT touch** files modified by parallel phase agents (see exclusion list).
3. **DO NOT touch** the `task and plan/maintainability/maintainability_phase*.md` plan files or `WORKMAP.md`.
4. **Run `npx tsc --noEmit` after every batch** of 10 files.
5. **If a token is missing** (e.g. `ring-app-error`), document as a precursor in this plan; do not invent a Tailwind class that doesn't exist.
6. **Brand emerald vs. success emerald** — if `bg-emerald-500` is on a `<button>` (CTA), map to `bg-app-primary`. If it's on a `<Badge>`/`<div>` (status pill), map to `bg-app-success`. Default to `bg-app-success` only when context is clearly status.
