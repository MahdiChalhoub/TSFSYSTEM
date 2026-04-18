# SAAS Org Detail Page — Refactor Continuation (002)

## Context

`src/app/(privileged)/(saas)/organizations/[id]/page.tsx` was 1503 lines.
Previous session (commit `3040002a` — bundled with unrelated mobile work) cut
it to **592 lines** by wiring up pre-existing `_components/` exports:

- Inline `UsageMeter` + `ModuleCard` helper defs → imports from `_components/`
- Inline Overview / Billing / Addons tab bodies → `<OverviewTab>`, `<BillingTab>`, `<AddonsTab>`
- 5 inline `<Dialog>` blocks → `CreateUserDialog`, `ResetPasswordDialog`, `CreateSiteDialog`, `PlanSwitchDialog`, `ClientAssignDialog` from `_components/OrgDialogs.tsx`
- Orphan state (`newUser`, `newSite`, `newClient`, `newPassword`, `clientSearch`, `showNewClient`, `creating`, `resetting`, `creatingSite`, `showPass`) and handlers (`handleCreateUser`, `handleResetPassword`, `handleCreateSite`) removed
- Dead lucide / `Dialog*` / `Input` imports pruned

**Still over the 300-line hard limit** (`.agent/rules/code-quality.md`). This plan covers getting it under.

## Goal

Page under 300 lines. Remaining inline tabs extracted into `_components/`. Orchestration extracted to a `useOrganizationDetail` hook.

## What's left inline (approximate line counts)

- Modules tab — 24 lines
- Users tab — 60 lines
- Sites tab — 71 lines
- Usage tab — 35 lines
- Branding tab wrapper — 17 lines (already mostly delegated to `BrandingTab`)

Plus ~130 lines of state + handler functions (`load()`, `handleToggle`, `handleFeatureToggle`, `handleToggleSite`, tab list, derived values).

## Files to change

- `src/app/(privileged)/(saas)/organizations/[id]/page.tsx` — thin orchestrator, <300 lines.
- `src/app/(privileged)/(saas)/organizations/[id]/_components/ModulesTab.tsx` — NEW.
- `src/app/(privileged)/(saas)/organizations/[id]/_components/UsersTab.tsx` — NEW.
- `src/app/(privileged)/(saas)/organizations/[id]/_components/SitesTab.tsx` — NEW.
- `src/app/(privileged)/(saas)/organizations/[id]/_components/UsageTab.tsx` — NEW.
- `src/app/(privileged)/(saas)/organizations/[id]/_hooks/useOrganizationDetail.ts` — NEW (see below).

## New component interfaces (proposed)

### `ModulesTab`
```tsx
{ modules: SaasModule[]; toggling: string | null; onToggle: (code, status) => void; onFeatureToggle: (code, feature, enabled) => void }
```

### `UsersTab`
```tsx
{ users: SaasUser[]; onCreateUser: () => void; onResetPassword: (user) => void }
```

### `SitesTab`
```tsx
{ sites: SaasSite[]; onCreateSite: () => void; onToggleSite: (id) => Promise<void> }
```

### `UsageTab`
```tsx
{ usage: SaasUsageData | null; modules: SaasModule[] }
```

## Hook extraction — `useOrganizationDetail(orgId)`

Encapsulates: load, refresh, toggle, feature-toggle, plan-switch, client assign/unassign, encryption-toggle, site-toggle. Returns:

```ts
{
    org, usage, billing, modules, users, sites, addons, encryptionStatus,
    loading, toggling, switching, togglingEncryption,
    purchasingAddon, cancellingAddon, savingClient, allClients,
    refresh, toggleModule, toggleFeature, switchPlan, assignClient, unassignClient, createAndAssignClient,
    createUser, resetPassword, createSite, toggleSite,
    purchaseAddon, cancelAddon, toggleEncryption, searchClients, updateSettings,
}
```

Keeps `page.tsx` as pure orchestration: dialogs, tabs, header, tab-bar.

## Estimated line budget

- `page.tsx` with hook + all tab components extracted: **≈150 lines**
- Each new `_components/*Tab.tsx`: 40–100 lines
- `useOrganizationDetail.ts`: ≈250 lines (consolidates current state + handlers)

Hook file over 300 is tempting to split further (`useOrgActions`, `useOrgData`). Deferred unless it exceeds the limit.

## Migrations / data changes

None.

## Tests

No current tests on this page. Add:
- `BillingTab.test.tsx` — render with mock data, click Switch Plan triggers callback.
- `useOrganizationDetail.test.ts` — mock `./actions` module, verify refresh sequences (usage → billing retry behaviour from commit `d9d576ec`).

Tests optional for first landing; track in a follow-up if skipped.

## Risk / rollback

- Medium risk: 4 new components + 1 hook. Every tab flows through new code.
- Rollback: `git revert <commit>` on the landing commit.
- Smoke-test checklist before landing:
    1. Tab switch doesn't crash on all 8 tabs.
    2. Module enable/disable reflects in Usage tab counts.
    3. Plan switch → billing history grows (single path, race-condition retry still works).
    4. Create user / site / reset password dialogs still round-trip.
    5. Client assign / unassign / create-and-assign all work from the dialog.
    6. Encryption toggle flips status without reload.

## Out of scope

- Styling changes. Keep classes identical.
- Backend changes. Only frontend extraction.
- Tests (see above — preferred but optional).
- The still-existing `@ts-nocheck` at the top of `page.tsx`. Untangling types is a separate effort.

## Estimated effort

3–5 focused hours including smoke-test in browser.
