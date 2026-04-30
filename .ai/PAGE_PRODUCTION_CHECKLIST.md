# Page Production Checklist

**Status**: ACTIVE
**Version**: 1.0.0
**Last Updated**: 2026-04-30
**Applies to**: every page route in `src/app/**/page.tsx`

---

## Purpose

When a page is moving from **in-progress** to **production**, every item in this checklist must be either:
- ✅ at **11/10** (default acceptance bar), or
- ✅ at a lower score with a **named reviewer override** and a written reason.

A page does **not** ship until every row of its checklist record is signed off.

---

## How to use this checklist

### 1. Run the mechanical validator

```bash
node .ai/scripts/check_page_ready.js src/app/<path>/page.tsx
```

It auto-checks the items it can verify mechanically (file size, tour pair, i18n usage, TODOs, etc.) and prints a score plus a copy-paste markdown block.

### 2. Fill in the per-page record

Paste the script output into the page's PR description (or a `_meta/READINESS.md` next to the page if you want a permanent record). Score each manual item. For any item below 11/10, fill the override fields.

### 3. Get reviewer sign-off

Share the filled checklist with the reviewer (the second user). Reviewer either:
- Stamps each manual item with their score + sign-off, **or**
- Accepts a lower score on a specific item, recording: their name, the score, and the reason.

### 4. Ship

Only when every row has a green check or a documented override.

---

## The 11 items

Each item below names what is checked, the **mechanical signal** the validator looks for, and the **manual review questions** that must be answered.

---

### 1. Mobile compatibility

> Does the page work on a phone? Layout, taps, overflow, drawer/sheet patterns?

- **Mechanical**: count of responsive utility classes (`sm:`, `md:`, `lg:`, `xl:`); minimum **5** distinct uses.
- **Manual review**:
  - Open page at viewport ≤ 414px in Chrome devtools — does it render without horizontal scroll?
  - Are tap targets ≥ 32px tall?
  - Are modals / drawers usable on small screens?
- **Default acceptance**: 11/10 (works perfectly on iPhone SE-class device).

---

### 2. Tour (desktop + mobile)

> Is there a guided tour wired in, with a separate mobile variant?

- **Mechanical**:
  - File `src/lib/tours/definitions/<page-slug>.ts` exists.
  - File `src/lib/tours/definitions/<page-slug>-mobile.ts` exists.
  - JSX in `page.tsx` (or its components) contains at least 3 `data-tour="…"` anchors.
- **Manual review**:
  - Run the tour end-to-end on desktop — does every step land on a visible element?
  - Run the tour end-to-end on mobile (`-mobile.ts`) — different anchors where layout differs?
  - Does the tour actually teach what's important on this page (not "click here, click there")?
- **Default acceptance**: 11/10 (a new user understands the page after one tour run).

---

### 3. Security — basic checks

> No secrets in the file, no obvious injection vectors, write operations are audited.

- **Mechanical**:
  - No hard-coded API keys, tokens, or passwords (regex sweep).
  - No `dangerouslySetInnerHTML` (or, if present, called out for #10 review).
  - No `eval(` / `new Function(`.
  - No `console.log` of user data.
- **Manual review**:
  - All form inputs validated at the API boundary (not just client-side)?
  - Server actions / API calls explicitly reject unauthorized tenants?
  - Write operations emit audit events (`AuditLogMixin` on the model, or explicit audit emit)?
- **Default acceptance**: 11/10 (no vector you could explain in one sentence to attack this page).

---

### 4. Multilanguage (i18n)

> Every user-facing string goes through translation, no raw English in JSX.

- **Mechanical**:
  - `useTranslation()` or `t(` usage detected in the file.
  - Heuristic raw-string scan: count of `>[A-Z][a-z]+ [a-z]` patterns inside JSX (English phrases) — should be near zero outside of explicit overrides.
- **Manual review**:
  - All button labels, headings, table column headers via `t()`?
  - Date/number formatting locale-aware?
  - Direction-aware (RTL) where the design has chirality?
- **Default acceptance**: 11/10 (page works fully in every supported locale).

---

### 5. Files refactored / size

> The file is the right size and decomposed into the right pieces.

- **Mechanical**:
  - `page.tsx` ≤ **400 lines**.
  - Sub-components in `_components/` directory next to the page.
  - Types in `_lib/types.ts` not inlined.
- **Manual review**:
  - Are subcomponents named for **what they are**, not **where they appear**?
  - Is duplicated logic extracted into hooks / utils?
  - Could a new dev land in this folder and find every relevant file in 30 seconds?
- **Default acceptance**: 11/10.

---

### 6. Easy to maintain

> Future-you (or another dev) can change this page without re-reading every line.

- **Mechanical**:
  - No `TODO` / `FIXME` / `XXX` / `HACK` left in.
  - No `console.log` / `console.warn` (use proper logger).
  - ESLint passes.
  - TypeScript passes.
- **Manual review**:
  - Component names communicate intent?
  - Comments explain **why**, not **what**?
  - State management understandable on first read?
- **Default acceptance**: 11/10.

---

### 7. Did it achieve 11/10? — overall design

> The visual & interaction quality bar.

- **Mechanical**:
  - Uses the `page-header-icon` utility (consistent header).
  - No `text-[8px]` / `text-[9px]` (below accessibility minimum; use `text-tp-xxs` token).
  - No raw hex colors (`#[0-9a-f]{3,6}` outside theme variable definitions).
  - No `style={{ background: 'rgb...' }}` / inline literal palettes (allowed inside `color-mix` recipes).
- **Manual review**:
  - Does the page hold up next to `chart-of-accounts` / `numbering-codes` reference pages?
  - Does the user — looking at the screen — say "this is a tool I want to use"?
  - Is there one **memorable** detail (the thing they remember tomorrow)?
- **Default acceptance**: 11/10. **Cannot be self-graded** — must have a second-user sign-off.

---

### 8. Tenant isolation

> Data shown is scoped to the current tenant, no cross-tenant leak path.

- **Mechanical**:
  - Page is under the `(privileged)` route group, **or** explicit permission/RBAC check is present in the file.
  - All API calls go through `erpFetch` (tenant header injected) — no raw `fetch('http(s?)://')` of internal endpoints.
- **Manual review**:
  - Models the page reads/writes inherit `TenantOwnedModel`?
  - Server actions use the request's tenant, never a client-supplied tenant id?
  - URLs / query params do not leak tenant identifiers?
- **Default acceptance**: 11/10 — **non-negotiable**, no override possible.

---

### 9. Permissions created

> A permission key exists, is registered with the kernel, and is checked.

- **Mechanical**:
  - Page is under `(privileged)` OR uses `require_permission` / `usePermission` / equivalent guard.
  - Referenced permission keys exist in the permission registry.
- **Manual review**:
  - Is the **least-privilege** permission used (not a generic admin scope)?
  - Are mutation actions guarded separately from read?
  - Does the permission show up in the role-management UI for tenant admins?
- **Default acceptance**: 11/10 — **non-negotiable**, no override possible.

---

### 10. Security is 11/10

> Final security stamp after #3 mechanical pass.

- **Mechanical**: rolls up #3 results.
- **Manual review**:
  - Penetration / threat model walked: input validation ✓ output encoding ✓ auth ✓ authorization ✓ audit ✓ rate-limit ✓?
  - Any field a tenant admin can edit that flows to a SQL/NoSQL query is parameterized?
  - File uploads (if any) sandboxed and content-type-validated?
- **Default acceptance**: 11/10. Lower scores require **named reviewer override** with a documented residual risk.

---

### 11. Maintenance is 11/10

> Final maintainability stamp after #5 + #6 mechanical pass.

- **Mechanical**: rolls up #5 + #6 results.
- **Manual review**:
  - If you delete this page tomorrow and rewrite from scratch in 4 hours, would the rewrite end up the same? (sign of clear intent)
  - Imports use absolute paths consistently?
  - No orphan files (every file in the page's folder is reachable from `page.tsx`)?
- **Default acceptance**: 11/10. Lower scores allowed with override + reason.

---

## Per-page checklist record (template)

Copy this block into the PR description (or `_meta/READINESS.md` next to the page) and fill in. The validator script outputs the same template prefilled with mechanical results.

```markdown
## Page Production Readiness — `<route or page name>`

| # | Item                          | Score | ✓ Reviewer | Override reason (if < 11/10) |
|---|-------------------------------|-------|------------|------------------------------|
| 1 | Mobile compatibility          | /10   |            |                              |
| 2 | Tour (desktop + mobile)       | /10   |            |                              |
| 3 | Security — basic checks       | /10   |            |                              |
| 4 | Multilanguage (i18n)          | /10   |            |                              |
| 5 | Files refactored / size       | /10   |            |                              |
| 6 | Easy to maintain              | /10   |            |                              |
| 7 | Design 11/10                  | /10   |            |                              |
| 8 | Tenant isolation              | /10   |            | (override not allowed)       |
| 9 | Permissions created           | /10   |            | (override not allowed)       |
| 10| Security 11/10                | /10   |            |                              |
| 11| Maintenance 11/10             | /10   |            |                              |

**Reviewer**: `<name>`
**Date**: `YYYY-MM-DD`
**Status**: ☐ Approved for production / ☐ Changes requested

**Notes**:
```

---

## Override mechanism

For each item except **#8 (tenant isolation)** and **#9 (permissions)** — which are non-negotiable — the reviewer (a different user from the implementer) may accept a score below 11/10 by recording:

```markdown
**Item N override**
- Score: 8/10
- Accepted by: <reviewer name>
- Date: YYYY-MM-DD
- Reason: <one sentence — why this is acceptable for this page right now, what's the follow-up>
- Follow-up tracked in: <issue / TODO / ticket reference>
```

Items #8 and #9 are pass/fail. A page with a tenant-isolation gap or missing permission cannot ship.

---

## CI integration (future, optional)

The validator script is exit-coded so it can gate CI later:

```bash
# in CI
for page in $(git diff --name-only origin/main HEAD | grep 'page\.tsx$'); do
  node .ai/scripts/check_page_ready.js "$page" || exit 1
done
```

The mechanical checks block; the manual ones are recorded in PR description and reviewed by a human.

---

## Maintenance of this checklist

When a new architectural pattern is introduced (e.g., new tour system, new i18n strategy), update both:

1. The relevant item's **mechanical** section in this file.
2. The corresponding check in `.ai/scripts/check_page_ready.js`.

Keep them in lockstep — drift between doc and script silently weakens the gate.
