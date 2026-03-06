# TSF PLATFORM | Agent Release Tracker

| Date | Agent | Version | Changes |
| :--- | :--- | :--- | :--- |
| 2026-03-06 | Antigravity | 3.3.0-AG-260306.1202 | **Purchases Module Full Redesign (15 files, 5 phases)**: Rebuilt 11 pages + created 4 new pages (Credit Notes, Quotations/RFQ, Consignment Settlements). Created centralized `actions/pos/purchases.ts` with all 12 PO workflow actions (submit, approve, reject, send_to_supplier, cancel, record_supplier_declaration, mark_invoiced, complete, receive_line, add_line, remove_line, print). Redesigned PO detail page with contextual workflow action bar, 4 modal dialogs (receive, reject, declaration, invoice), responsive 3-col layout. Rebuilt receipts page (426→260 lines, built-in receive dialog). Fixed returns page missing `Undo2` import and broken API path. All pages follow Single-Pass Protocol: theme-* CSS vars, responsive breakpoints (320→1920px), 44px touch targets, shadcn/ui components, dark mode, skeleton loaders. |
| 2026-03-02 | Antigravity | 3.4.1-AG-260302.2008 | **Global Theme Engine + RBAC Guard**: Built 5-theme CSS engine (`midnight-pro`, `ivory-market`, `neon-rush`, `savane-earth`, `arctic-glass`) with `--app-*` CSS variable architecture. Rebuilt 7 module pages (Dashboard, Products, CRM, Finance, HR, Purchases, Inventory Movements), Sidebar, POSToolbar, POSLobby, POSLayoutSelector with full token theming. Added server cookie persistence (`settings/theme.ts` server actions + `layout.tsx` SSR seeding). Implemented frontend RBAC guard (`useHasPermission('app.change_theme')`) gating `AppThemeSelector`/`AppThemeTrigger`. Registered `app.change_theme` permission via backend data migration `erp.0008`. Fixed `sales/workflow-actions.ts` build (arrow→function declarations for Turbopack). |
| 2026-03-02 | Antigravity | 3.4.0-AG-260302.2008 | **Universal Tax Engine v1.0**: Replaced hardcoded `companyType` fiscal logic with a policy-driven architecture. Added `OrgTaxPolicy` (how the org behaves) and `CounterpartyTaxProfile` (what the counterparty is) models with migrations, serializers, ViewSets, and URL routing. Implemented `TaxEngineContext` with full scope guard (`vat_active = OFFICIAL ∩ vat_output_enabled`). Wired `resolve_invoice_type()` into POS checkout (auto-selects TVA_INVOICE / RECEIPT / INTERNAL_RECEIPT / SIMPLE_INVOICE). Added `OrderLineTaxEntry` for transactional per-line tax records. Rewrote `PurchaseService.quick_purchase()` with engine-driven cost resolution (3 cost views: `cost_official`, `cost_management`, `cost_ttc_embedded`). Implemented full purchase tax scenarios: VAT recoverable, AIRSI capitalize/expense/recover, Reverse Charge double-entry, export zero-rate. Added `PeriodicTaxAccrualService` (TURNOVER / PROFIT / FORFAIT modes), `VATSettlementViewSet` with refund receivable fix, and `VATReturnReportService` (7-section report from `OrderLineTaxEntry`). Shipped 3 management commands: `seed_org_tax_policy`, `seed_tax_profiles`, `assign_contact_tax_profiles`. |
| 2026-03-02 | Antigravity | 3.3.8-AG-260302.1050 | **V2 UI Overhaul & Core Pillars Redesign**: Upgraded Dashboard, Products Registry, CRM Contacts Hub, and Master Ledger to "V2.0 PRO" standard. Implemented ultra-premium Apple Minimalist aesthetic, intensive glassmorphism, dynamic glow effects, and enterprise-grade jargon replacement (e.g., Financial Vectors). Deprecated original templates to `page-legacy.tsx` for fast rollback. |

| 2026-03-01 | Antigravity | 3.3.7-AG-260301.1517 | **CRM Group Targeting**: Added `whatsapp_group_id` directly to the CRM `Contact` model. The background Celery notification worker dynamically scans for this attached ID—if a supplier or client has an active Group ID configured, alerts, automated documents, and promotions will automatically direct into the team WhatsApp channel instead of the individual's direct phone number. |
| 2026-03-01 | Antigravity | 3.3.6-AG-260301.1508 | **Account Book (Livre de Caisse) & Ledger Audit Engine**: Integrated POS Address Book to correctly map and route Partner Capital/Drawings transactions. Implemented `CASH_OVERAGE` and `CASH_SHORTAGE` auto-variance routines upon register closure. Generated immutable `DailyAddressBookSnapshot` records. Built a dedicated global Manager Audit Dashboard (`/finance/account-book`) for unified review of pending financial movements. |
| 2026-03-01 | Antigravity | 3.3.5-AG-260301.1500 | **WhatsApp Push API & UI**: Finalized the External Provider Settings Interface (`/settings/whatsapp`), supporting plug-and-play credentials for Twilio, MessageBird, and Official Meta APIs. Overhauled the Celery asynchronous worker to support **Dynamic External Routing**: Auto-tasks automatically resolve and text external Client/Supplier phone numbers if triggered by POS orders, Purchase Orders, or Promotions (`PROMOTION_TRIGGERED`, `EXTERNAL_DOCUMENT_SEND`). |
| 2026-03-01 | Antigravity | 3.3.4-AG-260301.1448 | **Automated Task Delivery (WhatsApp & Email)**: Upgraded the `User` model with a native `whatsapp_number` field. Injected a generic notification Celery task (`send_task_notification_async`) that automatically binds to Task creation (`post_save`). When any auto-task is assigned, the system now autonomously pushes real-time alerts via Email and WhatsApp to the assigned employee without blocking system performance. |
| 2026-03-01 | Antigravity | 3.3.3-AG-260301.1445 | **Auto-Tasking Engine v2.0 & Cross-Module Operations**: Upgraded the Auto-Task engine with 76+ pre-configured procedural rules across 7 modules (Inventory, Purchasing, CRM, POS, etc.). Introduced event-handling, chaining, recurrence (Celery Beat), and role-based broadcasts. Embedded 47 live signal triggers natively into POST/pre_save hooks for checkouts, stock mutations, returns, and expiry threshold alerting. |
| 2026-03-01 | Antigravity | 3.3.2-AG-260301.0609 | **Senior Audit — Phase 3+4 (POS & Platform Jargon Purge)**: Replaced 50+ jargon instances across 11 POS files (Neural→Calculator, Matrix→Cart/Grid, Protocol→Pay/Complete, etc). Fixed 20+ jargon labels in Purchases, SaaS, and Organizations pages. Removed 7 production console.log/debug statements from product forms. |
| 2026-03-01 | Antigravity | 3.3.1-AG-260301.0555 | **Senior Audit — Phase 1+2**: Fixed 6 critical violations (fake metrics, dead buttons, broken invoice filter, duplicate files, POS client search). Unified design system with `page-container`, `page-header-title`, `card-kpi`, `badge-status` CSS classes. Created `KPICard` and `PageSkeleton` reusable components. Unified 4 key pages to consistent emerald accent, slate gray, and standardized headers. Removed all dashboard jargon. |
| 2026-03-01 | Antigravity | 3.3.0-AG-260301.0451 | **POS Terminal Architecture Redesign**: Extracted all terminal state into `useTerminal` hook + `TerminalContext` (eliminates 80-prop drilling). Created `useBarcodeScanner` hook (fixes stale closures). Split 1,129-line POSLobby into 5 memoized step components. Reduced page.tsx from 939→285 lines. Fixed cloud sync race conditions. |
| 2026-03-01 | Antigravity | 3.2.2-AG-260301.0438 | **Smart Audit Intelligence System**: Overhauled Migration Review Dashboard with 3-column entity grid, triple-sample audit modal, ledger distribution panels, and high-level migration health stats. |
| 2026-03-01 | Antigravity | 3.2.1-AG-260301.0421 | **Sync Security & PWA Integrity**: Resolved 500 error on PosTicket bulk sync by injecting user context. Regenerated high-fidelity manifest icons and stabilized COA database migrations. |
| 2026-03-01 | Antigravity | 3.2.1-AG-260301.0322 | **Forensic Migration Hub & Ledger Integrator**: Redesigned the third-party import module with an Audit-First architecture. Introduced the Forensic Ledger Integrator for historical data verification, bulk audit approval APIs, and automated combo product detection. |
| 2026-02-28 | Antigravity | 3.1.3-AG-260228.2341 | **Finance Powerhouse Module Upgrade**: Deployed the Enterprise Fixed Assets Studio (Dual-pane, live projections, QR tracking) and the Bank Reconciliation Match-Maker Engine (Automation Linker, Dual-pane Studio). |
| 2026-02-28 | Antigravity | 3.1.3-AG-260228.2336 | **SaaS Hub Infrastructure Refinement**: Refactored organization data fetching for instant UI updates after plan switching. Injected premium PWA icons and manifest. Implemented Module Hot-Reload and Kernel Rollback API/Logic. Enhanced Global Registry with visual dependency status tracking. |
| 2026-02-28 | Antigravity | 3.1.3-AG-260228.2259 | **Finance/CRM Sync Fix**: Resolved "silently failing" subscription updates by fixing `SaaSClient.sync_to_crm_contact()` (prevented balance resets) and adding automatic sync on `save()`. Backfilled existing Demo client. **Inventory Audit**: Verified all 25 inventory pages and 20 action files (up from 16). Updated `MODULE_INVENTORY.md` documentation. |
| 2026-02-28 | Antigravity | 3.1.3-AG-260228.2236 | **Direct CRM Profile Link**: `billing` endpoint now resolves and returns `crm_contact_id` for the linked SaaS client. Frontend "View CRM Profile" button navigates directly to `/crm/contacts/{id}` instead of a search-based fallback. Added `SaasBillingClient` TypeScript interface with explicit `crm_contact_id` typing. Addresses WORKMAP `[OPEN] Direct CRM Profile Link`. |
| 2026-02-28 | Antigravity | 3.1.2-AG-260228.0323 | **Chart of Accounts UI Fix**: Resolved issue where imported clients/suppliers (sub-accounts) were not visible in the Chart of Accounts hierarchy due to a snake_case to camelCase mapping mismatch. |
| 2026-02-28 | Antigravity | 3.1.1-AG-260228.0142 | **Full-Stack Security Hardening**: HR module locked — Leave immutability, cross-tenant employee FK validation on Attendance/Leave. Ledger `clear_all` superuser-gated. TransactionSequence read-only. Complete ERP audit across Finance, CRM, HR, POS, Inventory. |
| 2026-02-28 | Antigravity | 3.1.0-AG-260228.0132 | **Financial Ledger Security Hardening**: Locked down Invoice, InvoiceLine, Payment, PaymentAllocation, DirectExpense, DeferredExpense models with immutability guards. Made CustomerBalance/SupplierBalance read-only. Secured CRM pricing views against cross-tenant injection. Fixed MigrationReviewDashboard missing imports crash. |
| 2026-02-27 | Antigravity | 3.0.8-AG-260227.2200 | **POS Core Transaction Fix**: Resolved a critical `AttributeError` (`order.ref`) in the backend checkout service that was causing live sales to roll back. |
| 2026-02-27 | Antigravity | 3.0.7-AG-260227.2105 | **Server Component Crash Fix**: Resolved a critical "client-side exception" by moving currency formatting logic to a server-safe module (`currency-core.ts`). |
| 2026-02-27 | Antigravity | 3.0.6-AG-260227.2055 | **Cross-Scope Detail Resolution & Hardening**: Fixed 404s on order detail pages by allowing single-record retrieval across scopes. Hardened Sale Record rendering with null-safety and detailed diagnostics. |
| 2026-02-27 | Antigravity | 3.0.3-AG-260227.1955 | **Sales History Audit & POS Stability**: Overhauled Sales History with full-screen layout, expandable line items, and interactive actions (Delete/Lock). Fixed critical 'discount_amount' bug in POS checkout. |
| 2026-02-27 | Antigravity | 3.0.2-AG-260227.1817 | **Scope Persistence & Reactivity**: Fixed `AdminContext` race condition, ensured `GeneralLedgerPage` reactivity, and secured switcher visibility. |
| 2026-02-27 | Antigravity | 2.9.4-AG-260227.1510 | **Production Audit & Stability Fixes**: Resolved POS Circular Import, fixed MCP async DB operations, corrected erp-fetch.ts base URL, optimized Nginx for Next.js API routes, and expanded CSP for Unsplash/Cloudflare. |
| 2026-02-27 | Antigravity | 2.9.3-AG-260227.1150 | **Critical Navigation & AI Module Visibility**: Fixed manifest, sidebar persistence, and added POS-to-Admin button. |
| 2026-02-27 | Antigravity | 2.9.2-AG-260227.1145 | **Sidebar & Navigation Overhaul**: Standardized 9 logical domains and cleaned up 14+ duplicate routes. |
| 2026-02-27 | Antigravity | 2.9.2-AG-260227.1119 | **Autonomous AI Agent System (Virtual Employees)**: Launched Agent Center, Pulse service, and Persona system. |
| 2026-02-27 | Antigravity | 2.9.1-AG-260227.0950 | **Module System & Wizard Security**: Hardened tenant isolation and standardized module manifest resolution. |
| 2026-02-27 | Antigravity | 3.0.1-AG-260227.1830 | **POS Layout & Scope Integration**: Fixed floating numpad build error, implemented client-side hydration safety for draggable overlays, and integrated `viewScope` from `AdminContext` into the POS checkout flow. |
| 2026-02-27 | Antigravity | 3.0.0-AG-260227.1645 | **Global Scope Filtering (Official vs Internal)**: Implemented robust data isolation for migrated historical records vs live data. |
| 2026-02-27 | Antigravity | 2.9.0-AG-260227.0830 | **Master Hub Launch**: Initial infrastructure for multi-domain orchestration. |

## v3.2.1-AG-260301.0421 - Sync Security & PWA Integrity
- **PosTicket Synchronization**:
    - Terminated **API 500 error** in `pos-tickets/sync-all` by correctly injecting `request.user` into the model persistence layer. 🛡️🏦✨
    - Stabilized **Cloud Persistence logic** for offline-first tickets; ensured mandatory foreign key integrity is maintained during bulk-batch updates. 🛡️🏗️✨
- **PWA Asset Restoration**:
    - Resolved **Icon Download Failure** by regenerating high-fidelity `icon-192.png` and `icon-512.png` assets to industrial standard PNG profiles. 🛡️🖼️✨
    - Simplified `manifest.json` by removing restrictive `purpose: maskable` declarations, optimizing the TSF installation prompt for **all mobile/desktop browsers**. 🛡️📱🏛️
- **Kernel & Database Hardening**:
    - Forensic cleanup of `coa_models.py` removed a stray syntax error that was obstructing the backend migration pipeline. 🛡️🏗️🚑
    - Synchronized `deploy_hotfix.sh` with the `--noinput` flag to prevent migration session staling in production environments. 🛡️🏗️🏁

## v3.1.3-AG-260228.2341 - Finance Powerhouse Module Upgrade
- **Enterprise Fixed Assets Studio**: 
    - Implemented a **Dual-Pane Acquisition Studio** with real-time **Net Book Value projections** using `recharts`.
    - Added **Asset Intelligence Strategies** (Basic, Professional, Enterprise) to settings.
    - Integrated **QR-Code Asset Tagging** for physical-to-digital audit synergy.
    - Full support for Linear, Declining (1.5x), Double-Declining (2x), and Units of Production depreciation methods.
- **Bank Reconciliation Match-Maker Engine**:
    - Transformed the static reconciliation list into an automated **Match-Maker Studio**.
    - Implemented **"Run Magic Linker"** automation with 3-tier probability scoring for bulk settlement.
    - Added **Dual-Desk Workspace** for manual exception resolution with residual gap monitoring.
    - Hardened the settlement guard for monetary balance integrity.

## v3.1.2-AG-260228.0323 - Chart of Accounts UI Fix
- **Backend Data Mapping**: Fixed a mapping issue in `src/app/actions/finance/accounts.ts` where the backend serialized DRF JSON `parent`, `sub_type`, `syscohada_code`, `syscohada_class`, and `is_active` were not correctly mapped to their camelCase equivalents (`parentId`, `subType`, etc.) expected by the `ChartOfAccountsViewer`. 
- **Sub-Ledger Visibility**: Imported Clients and Suppliers are correctly inserted into the DB as sub-accounts under `1200` and `2000`, but due to the missing `parentId` mapping, the UI was throwing them out of the hierarchical tree view. This fix properly nests them and makes them fully visible.

## v3.0.8-AG-260227.2200 - POS Core Transaction Fix
- **Backend Service Recovery**: Fixed an `AttributeError` in `POSService.checkout` where the code attempted to access `order.ref` (which doesn't exist) instead of `order.ref_code` during audit log generation. This bug was causing a database rollback on every checkout attempt, resulting in "Something Went Wrong" errors for users.
- **Migration Continuity**: Resumed the stalled background migration (Job #13) which was interrupted by service restarts. Standardized the transition between historical "Ghost" records and live transaction data.
- **Ghost Record Cleanup**: Purged 111,794 corrupted empty draft records created during deployment windows to restore Sales History clarity.

## v3.0.7-AG-260227.2105 - Server Component Crash Fix
- **Safe Rendering Module**: Split `currency.ts` into a core formatting library (`currency-core.ts`) and a React hook library. This prevents Server Components from attempting to import client-only hooks/state, which was causing the "client-side exception" crash on the Sale Detail page.
- **Architectural Cleanup**: Formalized the separation of pure formatting logic from UI lifecycle hooks, improving overall bundle size and build-time safety.

## v3.0.6-AG-260227.2055 - Cross-Scope Detail Resolution & Hardening
- **Backend Flexibility**: Modified `TenantModelViewSet` to allow record retrieval regardless of state scope (Official/Internal) for specific ID lookups. This prevents confusing 404s when a user views a direct record link while in a different scope mode.
- **Frontend Resilience**: Added comprehensive null-safety to the Sale Detail page. Grand totals, tax amounts, and line item properties now have default recovery values to prevent Server Component crashes.
- **Enhanced Diagnostics**: Improved the "Sale Not Found" error page with a diagnostic section (Attempted ID, Path, Context) to provide better visibility during audit troubleshooting.

## v3.0.5-AG-260227.2040 - Sale Detail Fix & Interactive Controls
- **API Routing Resolution**: Fixed a critical "Sale Not Found" error on the order detail page by switching from legacy flat paths (`orders/`) to namespaced module paths (`pos/orders/`). This ensures correct tenant isolation and prevents routing collisions.
- **Detailed Audit Actions**: Implemented `OrderActions` component in the Sale Detail page. Users can now perform one-click "Vérifier" (Verify) and "Verrouiller" (Lock) operations directly from the record header.
- **UX Localization**: Standardized audit button labels in French and improved the error state feedback (showing Attempted ID).

## v3.0.4-AG-260227.2015 - Hardened Scope Isolation (Middleware/Database)
- **Middleware Boundary**: Implemented `TenantMiddleware` enforcement that resolve effective scope per-request. No bypass is possible via header manipulation.
- **ORM-Level Jail**: Updated `TenantModelViewSet` to automatically cage all QuerySets and block unauthorized write attempts to 'INTERNAL' data from 'OFFICIAL' sessions.
- **Isolated Financial Audit**: Audit Logs and Forensic trails now capture record scope and filter history views dynamically, preventing data leakage via logs.
- **Report Engine Hardening**: Synchronous and Asynchronous (Celery) report generation now strictly respect the authorized scope during data aggregation and export.
- **COA Stability**: Patched Trial Balance and Account Statement endpoints to eliminate default scope vulnerabilities.

## v3.0.3-AG-260227.1955 - Sales History Audit & POS Stability
- **Sales History Redesign**: Switched to a full-screen layout (`w-full`) for better data visibility. Implemented `renderExpanded` in `TypicalListView` to display order line items (products, quantities, prices) directly in the table, enabling instant audit of inventory impacts.
- **Interactive Actions**: Added `deleteOrder`, `lockOrder`, and `verifyOrder` server actions. Integrated these into the UI with a premium `ConfirmDialog` for deletions and one-tap badge toggles for lock/verify status.
- **POS Critical Stability**: Fixed a `TypeError` in `POSService.checkout` where it was still referencing the deprecated `discount` field instead of `discount_amount`. This fix restores the ability to process payments and record sales.
- **UX Localization**: Standardized table actions in French (Voir, Modifier, Effacer) and improved empty states and search placeholders.
- **Context Synchronization**: Moved `router.refresh()` in `AdminContext.tsx` to a `useEffect` that triggers only *after* the `tsf_view_scope` cookie is persisted.
- **Ledger Reactivity**: Updated `GeneralLedgerPage` to correctly use the global `viewScope` from `AdminContext` and included it in the `loadEntries` dependency array.

## v3.0.2-AG-260227.1817 - Scope Persistence & Reactivity
- **Context Synchronization**: Moved `router.refresh()` in `AdminContext.tsx` to a `useEffect` that triggers only *after* the `tsf_view_scope` cookie is persisted. This prevents the "flash of old data" and the race condition where the server re-renders before seeing the updated cookie.
- **Ledger Reactivity**: Updated `GeneralLedgerPage` to correctly use the global `viewScope` from `AdminContext` and included it in the `loadEntries` dependency array, ensuring automatic re-fetches when switching between Internal and Official views.
- **Security & UI Hygiene**: Restricted the Scope Switcher component in `Sidebar.tsx` to `isSuperuser` or `dualViewEnabled` organizations, preventing unintended access for regular staff users.
- **API Continuity**: Explicitly passed `scope` parameter in `getLedgerEntries` server action to ensure backend filtering is always enforced based on the user's current frontend preference.

## v3.0.1-AG-260227.1830 - POS Layout & Scope Integration
- **Build Stability**: Resolved `ERR_UNKNOWN_FILE_EXTENSION` and hydration errors in `POSLayoutModern.tsx` by adding `isClient` safety guards and wrapping draggable components in client-only checks.
- **Scope-Aware POS**: Integrated `useAdmin` in `sales/page.tsx` to ensure POS transactions now respect the global `viewScope`. This allows users to correctly record internal sales when in Internal mode.
- **Robust Ledger**: Verified that the correction in `POSService.checkout` correctly applies the passed scope to both Orders and Journal Entries, completing the end-to-end data isolation chain.

## v3.0.0-AG-260227.1645 - Global Scope Filtering (Official vs Internal)
- **Backend Isolation**: Modified `TenantModelViewSet` to automatically filter by `X-Scope` header or `scope` query param.
- **Migration Data**: Updated `MigrationService` and `fix_migration_sites.py` to tag all historical data as `INTERNAL`.
- **Frontend Reactivity**: Updated `AdminContext`, `erpFetch`, and API Proxy to correctly propagate and persist scope choice.
- **UI Synced**: Refactored Dashboard, Sales History, Expenses, and Payments pages to automatically refresh when scope is toggled.
- **Financial Ledger**: Confirmed Journal entries and CoA reports respect the global scope filtering.

## v2.9.4-AG-260227.1510 - Production Audit & Stability Fixes
- **POS Critical Fix**: Resolved Circular Import by creating `register_serializers.py` and updating imports. Fixes 404s for POS endpoints.
- **AI/MCP Stability**: Fixed `SynchronousOnlyOperation` in agent execution using `sync_to_async`.
- **Connectivity Fix**: Updated `erp-fetch.ts` to include mandatory `/api/` prefix and standard Token auth. Fixes 404s in Storefront/Portal.
- **Nginx & UI Fix**: Routed `/api/org-currency` to frontend and expanded CSP to allow `*.unsplash.com` and `*.cloudflareinsights.com`.
- **Navigation**: Confirmed AI & Intelligence module visibility and POS-to-Admin back button.

## v2.9.3-AG-260227.1150 - AI & Navigation Critical Fix
- **Navigation Patch**: Added [Back to Admin] button in POS Toolbar for quick return to dashboard.
- **AI Module Visibility**: Fixed `Sidebar.tsx` to prevent AI module flickering and ensured `mcp` is in `ALL_KNOWN_MODULES`.
- **System Service**: Registered AI (MCP) manifest to backend system modules registry for correct tenant-level recognition.
- **Deployment**: Updated `deploy_hotfix.sh` to handle backend restarts more effectively.

##  - Universal Tax Engine & CRM Integration
- **Universal Tax Engine**: Added multi-tax support per line, VAT settlements, and periodic accruals.
- **Tax Profiles**: Introduced `OrgTaxPolicy` and `CounterpartyTaxProfile` to replace legacy fixed VAT settings.
- **Frontend Features**: Added VAT Settlement portal, VAT Reports, and Tax Policy views under Finance.
- **CRM Integration**: Contact form now supports assigning `CounterpartyTaxProfile`.
- **Bugfixes**: Resolved `pos` index migration conflict and recovered database from ENOSPC constraints.

## v3.3.0-AG-260305.0239 — 2026-03-05
**Dynamic Multi-Level Lifecycle System Level-Up**
- **Lifecycle Kernel**: Implemented `VerifiableModel` mixin and `TransactionLifecycleService` (666 lines) for enterprise-grade approval workflows.
- **Dynamic Rules**: Added `ApprovalRule` with JSON condition evaluation (e.g., "Amount > 10k → 3 Levels").
- **Immutability Guards**: Transactions now automatically freeze upon `LOCKED` status, preventing unauthorized edits during verification.
- **REST API**: Deployed 6 new endpoints under `/api/lifecycle/` for Lock/Verify/Override operations.
- **Frontend UI**: Built `LifecycleBadges`, `LifecycleActions`, and `LifecycleHistory` (Timeline) shared components.
- **Migrations**: Added `finance.0014` extending Invoice, Payment, and JournalEntry with lifecycle progress tracking.
- **Audit Trail**: Enhanced Ledger Audit with rule-bypass tracking and manager override logging.
