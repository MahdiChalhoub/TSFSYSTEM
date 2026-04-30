# Plan — Page Production Checklist

**Date**: 2026-04-30
**Scope**: New process artifact + mechanical validator script
**Risk**: ZERO (no production code touched, no model/API changes)

## Files created

1. `.ai/PAGE_PRODUCTION_CHECKLIST.md` — the human/agent-facing checklist
2. `.ai/scripts/check_page_ready.js` — mechanical validator (Node, no deps)

## Files NOT touched

Everything else. No changes to live pages, models, APIs, or routes.

## Item structure (11 items, deduped from user's list)

| # | Item | Mechanical check | Manual review |
|---|---|---|---|
| 1 | Mobile compatibility | responsive utils count (sm:/md:/lg:) | UX walkthrough on phone viewport |
| 2 | Tour (desktop + mobile) | tour file pair exists in `src/lib/tours/definitions/`; `data-tour` anchors present | tour completes end-to-end |
| 3 | Security checks | no secrets in file, no `dangerouslySetInnerHTML`, no `eval` | input validation, audit log on writes |
| 4 | Multilanguage (i18n) | `useTranslation()` / `t(` usage | no raw English in JSX |
| 5 | Refactored / file size | LOC ≤ 400 for `page.tsx` | components extracted appropriately |
| 6 | Maintenance | no TODO/FIXME/console.log; ESLint clean | naming, comments, readability |
| 7 | Design 11/10 | uses `page-header-icon`, no `text-[9px]`, no raw hex colors | overall visual quality |
| 8 | Tenant isolation | route under `(privileged)` OR explicit permission check | no cross-tenant data leak |
| 9 | Permissions created | permission key referenced; route protected | matrix of role → permission |
| 10 | Security 11/10 | (rolls up #3) | full security review sign-off |
| 11 | Maintenance 11/10 | (rolls up #5+#6) | final maintainability sign-off |

## Acceptance gates

Each item is **default 11/10**. If a reviewer accepts a lower score, the checklist template requires:
- `Score: X/10`
- `Accepted by: <name>`
- `Reason:`

Page does not promote until every row has either ✓ at 11/10 or a documented override.

## Script behavior

`node .ai/scripts/check_page_ready.js <path-to-page.tsx>` outputs:

- ✓ / ✗ / ◯ per item (◯ = manual review required)
- Mechanical score: X / N-mechanical
- A copy-paste markdown block for filling into the per-page checklist record

Exits non-zero only if mechanical checks fail (so it can gate CI later if desired).

## Architecture compliance

- No models touched → TenantOwnedModel/AuditLogMixin N/A
- No `get_config` calls (these are tooling files, not runtime config)
- No cross-module imports (the script is standalone Node, no project imports)
- Validator follows the same pattern as `.ai/scripts/validate_architecture.py`
