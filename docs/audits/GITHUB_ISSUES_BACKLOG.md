# GitHub Issues Backlog
Converted from `SENIOR_AUDIT_REPORT.md`

## 🔴 CRITICAL SEVERITY (P0)

### [C1] Dashboard Hardcoded Fake Metrics
**Description:** The dashboard displays hardcoded `resolutionRate = 84.2` and other fake metrics. These must be replaced with real backend-computed metrics or disabled fully.
**Labels:** `bug`, `critical`, `frontend`

### [C2] Dashboard Buttons Do Nothing
**Description:** "Network View" and "Extract Report" on the Dashboard do nothing on click. They need to either trigger real features or be disabled/hidden.
**Labels:** `bug`, `critical`, `ux`

### [C3] Invoices Page Passes Unfiltered Data
**Description:** The `<TypicalListView>` receives the raw unfiltered invoices array instead of the `filtered` array, meaning tab filters (DRAFT, SENT, OVERDUE) don't actually work.
**Labels:** `bug`, `critical`, `finance`

### [C4] Duplicate POSLobby Components
**Description:** `src/components/pos/POSLobby.tsx` is an unmaintainable 77KB monolith and has a duplicate `src/components/pos/lobby/POSLobby.tsx`. Consolidate and split into <300 line subcomponents.
**Labels:** `refactor`, `critical`, `pos`

### [C5] POSLayoutModern.tsx.top Stale File
**Description:** There is an invalid `.tsx.top` file that needs to be deleted to avoid confusion and bundle issues.
**Labels:** `cleanup`, `tech-debt`

### [C6] filteredClients Used Without Declaration
**Description:** `POSLayoutClassic.tsx` references a `filteredClients` array that isn't declared, causing a potential runtime crash when searching clients.
**Labels:** `bug`, `critical`, `pos`

---

## 🟠 HIGH SEVERITY (P1)

### [H1] No Shared Design System
**Description:** The codebase lacks visual cohesion, with 3-4 different accent colors, border radii, and background treatments across main modules (Dashboard, Contacts, Invoices, Products).
**Labels:** `design-system`, `high`

### [H2] Inconsistent Page Containers
**Description:** Page wrappers differ widely across modules (`page-container`, `max-w-7xl mx-auto`, `p-8 max-w-[1600px]`, etc.). Unify them under one layout structure.
**Labels:** `design-system`, `high`

### [H3] Mixed Data Fetching Patterns
**Description:** Some server components use `erpFetch`, while some client components use `useEffect + import().erpFetch`, and others use Server Actions. Standardize data fetching approaches.
**Labels:** `architecture`, `high`

### [H4] Missing Dedicated Action Files
**Description:** Only 14 action files exist for 91 pages. Extract data fetching from pages into dedicated modular `actions.ts` files.
**Labels:** `architecture`, `high`

### [H5] 53 Pages Exceeding 15KB Monolith Limit
**Description:** Over half the application's pages are monolithic (e.g. pos-settings has 1,504 lines). Systematically apply the refactor-and-audit workflow to split these.
**Labels:** `refactor`, `high`

### [H6] Excessive "any" Type Usage
**Description:** Components are missing structured types, heavily relying on `any`. Add proper TypeScript interfaces inside `src/types/`.
**Labels:** `typescript`, `high`

### [H7] Unconnected Batch Import Button
**Description:** The Batch Import button on Invoices throws a dummy toast. It needs to be feature-flagged or implemented.
**Labels:** `ux`, `high`

### [H8] Manual camelCase Mapping Fragility
**Description:** `Contacts` page manually remaps snake_case strings. Install `camelize-ts` or create an interceptor to auto-convert API responses.
**Labels:** `architecture`, `high`

### [H9] Missing Error Boundaries
**Description:** Only the root layout has an `error.tsx`, meaning an isolated failure will crash the entire platform. Add module-level boundaries (`finance/error.tsx`, etc.).
**Labels:** `reliability`, `high`

### [H10] console.error Leaks in Production
**Description:** `console.error` logs are left in components like `contacts/page.tsx`. Clean them up and set up a proper logger.
**Labels:** `cleanup`, `high`

### [H11] TypicalListView Double-Filtering Danger
**Description:** `<TypicalListView>` may perform its own internal filtering while also being passed a pre-filtered list, indicating conflicting patterns.
**Labels:** `architecture`, `high`

---

*(Medium, Low, and Cosmetic issues are deferred for Sprint 2.)*
