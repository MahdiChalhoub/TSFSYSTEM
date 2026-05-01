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

## Critical rules for the executing agent

1. **PRESERVE VISUAL OUTPUT in light mode.** Don't replace `text-blue-600` with `text-app-error`. Match meaning.
2. **DO NOT touch** files modified by parallel phase agents (see exclusion list).
3. **DO NOT touch** the `task and plan/maintainability/maintainability_phase*.md` plan files or `WORKMAP.md`.
4. **Run `npx tsc --noEmit` after every batch** of 10 files.
5. **If a token is missing** (e.g. `ring-app-error`), document as a precursor in this plan; do not invent a Tailwind class that doesn't exist.
6. **Brand emerald vs. success emerald** — if `bg-emerald-500` is on a `<button>` (CTA), map to `bg-app-primary`. If it's on a `<Badge>`/`<div>` (status pill), map to `bg-app-success`. Default to `bg-app-success` only when context is clearly status.
