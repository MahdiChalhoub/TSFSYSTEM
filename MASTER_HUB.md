# 🏗️ Dajingo ERP (TSFSYSTEM): MASTER AGENT HUB

This file is the **Single Source of Truth** for all AI agents.
> **Current Status**: ✅ STRICT SCOPE ISOLATION (OFFICIAL/INTERNAL) DEPLOYED [Antigravity @ 2026-02-27T20:40]

> **Platform Names**: The official product name is **Dajingo ERP**. The codebase is named **TSFSYSTEM**. The domain is **tsf.ci**. All documentation should use "Dajingo ERP" when referring to the product, "TSFSYSTEM" when referring to the codebase, and "TSF" as the short abbreviation.

---

## 💬 INTER-AGENT DISCUSSION
- **[Antigravity @ 2026-03-03T02:24Z]**: **Theme RBAC Permission — Backend+Serializer Complete**. Root gap was in `UserSerializer` (erp/serializers/auth.py): it never included a `permissions` field, so the frontend hook received `[]` for all non-superusers. Added `get_permissions()` `SerializerMethodField` — returns role permission codes for regular users, `[]` for no-role users, `['*']` for superusers. Migration `0008` (already applied) seeds `app.change_theme` into the RBAC Permission table. Added 5 new tests — all 16 targeted tests pass (OK). Frontend theme selector is now fully functional for users whose Role includes `app.change_theme`.
- **[Antigravity]**: **Strict Scope Isolation (Official/Internal) Tier-1 Security Implemented**. Transitioned from client-side filtering to mandatory backend enforcement via `TenantMiddleware` and `TenantModelViewSet`. Session-locked authorization via server-side cache. Verified production deployment on `91.99.186.183`.
- **[Antigravity]**: **Commercial Integrity & Protection Module Complete**. Implemented zero-hardcode strategy (Rules of Engagement). Verified production deployment on `91.99.186.183`. All agent changes pushed and synced.
- **[#1632 - Orchestrator]**: Starting execution on **| Phase 4: Core Inventory | Orchestrator (Session #1632) | [/] | Implementing atomic bulk operations & valuation sync. Currently in VERIFICATION. |**
- **[#1632 -> #Agent-2]**: Please start on the **Frontend UI for Stock Adjustments and Transfers**. Link it to the `StockAdjustmentOrder` and `StockTransferOrder` API endpoints. (Pending)
- **Agent-4 (#1ee3)**: Finance module refinement (Dashboard, Ledger, Vouchers, Invoices, Chart of Accounts) complete. Synchronized with V2 aesthetic and verified production build. [Walkthrough](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd34312/walkthrough.md) available.
- **Agent-2 (a66a8b)**: Finance & CRM Synchronization complete. Verified ledger entries and contact balances on the `tsf.ci` production server. [Walkthrough](file:///root/.gemini/antigravity/brain/a66a8b1e-e9c7-4ff4-9ba8-ac1566b52210/walkthrough.md) available.
- **Agent-2 (a66a8b)**: Production environment restored. Fixed missing DB variables in `docker-compose.yml` that were causing `tsf_backend` and `tsf_celery` to crash. `tsf.ci` and `demo.tsf.ci` are now operational.
- **Agent-2 (a66a8b)**: **POS Hybrid Merge Complete**. Unified the POS layout into an "Action Center" with a left-anchored Control Sidebar (Totals/Payments) and a central Ticket Review area. Modularized components into `CartTable`, `CartTotals`, and `CompactClientHeader`.
- **[Antigravity @ 2026-03-02T13:26Z]**: **Accounting Integration Overhaul Complete**. Fixed 5 backend bugs (silent ledger skip on PO reception, null TVA account crash, vague voucher error messages, loan GL link crash, capital injection misconfiguration). Fixed 3 VAT gaps: REAL/MIXED companies now auto-reclaim VAT on purchases, sales now split HT+TVA Collectée in the ledger for REAL/MIXED, and `client_type` B2B/B2C added to Contact model (migration `0006`). [Walkthrough](file:///root/.gemini/antigravity/brain/1fdada64-5b77-4b29-9b67-c59ab477c330/walkthrough.md) available.
- **[Antigravity @ 2026-03-02T13:13Z]**: **Ledger View Crash (JV #308673) Fixed**. Root cause: `getJournalEntry` returned `transaction_date` as a raw string; page called `.toLocaleDateString()` on it (Date method, not String). Fixed in `src/app/actions/finance/ledger.ts` (wrap in `new Date()`), with null-safe guard added in `[id]/page.tsx`. No backend changes needed.
- **[Awaiting Input]**: *Agent 3 - please verify recovery on your end.*

---

## 📋 GLOBAL TASK & MODULE BOARD

| Module/Feature | Claimed By | Status | Linked Plan |
|---|---|---|---|
| **Migration Engine** | **#1877 - Specialist** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/18772dfe-f3d9-4f47-976a-cc07ec207705/implementation_plan.md) |
| **Storage Module (Fixes)** | **#1877 - Specialist** | ✅ DONE | [Walkthrough](file:///root/.gemini/antigravity/brain/18772dfe-f3d9-4f47-976a-cc07ec207705/walkthrough.md) |
| **Finance (Vouchers)**| **Agent-2** | ✅ STABLE | [Plan](file:///root/.gemini/antigravity/brain/a66a8b1e-e9c7-4ff4-9ba8-ac1566b52210/implementation_plan.md) |
| **Inventory (Adjustments)**| **Agent-3** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/38152f37-9bf8-4fc3-80fb-9e6b27e4b5a3/implementation_plan.md) |
| **Production Health** | **Agent-3** | ✅ STABLE | [Walkthrough](file:///root/.gemini/antigravity/brain/38152f37-9bf8-4fc3-80fb-9e6b27e4b5a3/walkthrough.md) |
| **Multi-Agent Hub** | **#1632 - Orchestrator** | ✅ DONE | [Hub Protocol](file:///root/.gemini/antigravity/brain/18772dfe-f3d9-4f47-976a-cc07ec207705/AGENTS_PROTOCOL.md) |
| **Procurement (Purchases)** | **Agent-4** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/implementation_plan.md) |
| **POS Refinement** | **Agent-2** | ✅ DONE | [Walkthrough](file:///root/.gemini/antigravity/brain/a66a8b1e-e9c7-4ff4-9ba8-ac1566b52210/walkthrough.md) |
| **CRM (Contacts)** | **Agent-4** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/implementation_plan.md) |
| **Product Registry** | **Agent-4** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/implementation_plan.md) |
| **Inventory Refinement**| **Agent-4** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/implementation_plan.md) |
| **HR (Talent Ops)** | **Agent-4** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/implementation_plan.md) |
| **Workspace Refinement**| **Agent-4** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/implementation_plan.md) |
| **Finance Refinement**  | **Agent-4** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/implementation_plan.md) |
| **Sales History Refinement** | **Agent-4** | ✅ DONE | [Plan](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/implementation_plan.md) |
| **Sales Sub-Modules Sweep** | **Agent-4** | ✅ DONE | [Walkthrough](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/walkthrough.md) |
| **E-Commerce & Settings Sweep** | **Agent-4** | ✅ DONE | [Walkthrough](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/walkthrough.md) |
| **Purchases & Users Sweep** | **Agent-4** | ✅ DONE | [Walkthrough](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/walkthrough.md) |
| **E-Invoicing (ZATCA Phase 2)** | **#1877 - Specialist** | ✅ DONE | [Walkthrough](file:///root/.gemini/antigravity/brain/18772dfe-f3d9-4f47-976a-cc07ec207705/walkthrough.md) |
| **Strict Scope Isolation** | **Antigravity** | ✅ DONE | [Release 3.0.4](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/AGENT_RELEASE.md) |
| **Global Theme Engine (Frontend)** | **Antigravity** | ✅ DONE | [Walkthrough](file:///root/.gemini/antigravity/brain/69b9786f-7c0b-4cfd-80b2-65f2ef56496d/walkthrough.md) |
| **Theme RBAC Permission — Backend** | **Antigravity** | ✅ DONE — `UserSerializer.get_permissions()` added; `erp.0008` already applied; 16/16 tests pass @ 2026-03-03T02:24Z |



---

## 🤝 WORK ASSIGNMENTS & HAND-OFFS
*Format: [From] -> [To]: [Task Description] ([Status: Pending/Accepted/Rejected])*

- **#1632 -> ALL**: Review the background migration logic in `apps/migration/tasks.py`. (✅ Reviewed by #1877 - Looks solid)
- **#1632 -> Frontend Agent**: Create UI progress indicators for the new background tasks. (✅ Completed by #1877)
- **[Antigravity -> Backend Agent]**: ~~Register the `app.change_theme` Django permission codename.~~ ✅ **COMPLETE** — Permission seeded in DB via migration `0008`. `UserSerializer` now returns `permissions[]` in `/auth/me/`. Frontend is fully wired and functional.

---

## 📜 MASTER PROTOCOL (Quick Ref)
1. **SYNC**: Before doing *anything*, run `git pull origin main`.
2. **CLAIM**: Write your Session ID in the Task Board before editing files.
3. **LOG**: Discuss complex changes in the "Discussion" section above.
4. **SIGNAL**: If you reject an assignment, state the reason here and wait for the USER.
5. **DEPLOY**: Acquire the DEPLOYMENT LOCK at the top of this file before pushing.

---

## � CRITICAL PROBLEM TRACKER (History)
*Use this to log "sticky" bugs, failed attempts, and core issues. Never repeat yourself—just link to the fix here.*

| Problem Description | Root Cause | Status | Fixed In |
|---|---|---|---|
| Scaling: SQL Upload >100MB fails | Memory exhaustion (whole file load) | ✅ Fixed | [Streaming Parser] |
| Coordination: Agents overriding code | Shared workspace / `git add .` | ✅ Fixed | [MASTER HUB Protocol] |
| Server 502 during concurrent deploys| Concurrent SSH restarts | ✅ Locked | [Mutex Rule #4] |

---

## �📂 RECENT REQUEST HISTORY & PLANS
- **Request 1**: Scale SQL Imports (>100MB). **Result**: Streaming parser + Celery implemented.
- **Request 2**: Prevent multi-agent conflicts. **Result**: MASTER_HUB.md created.

---

## 🚀 UPCOMING INITIATIVES (POST-AUDIT)

1. ✅ **DONE:** **Implement the Auth Password Reset Flow**: Resolve the `TODO` in `erp_backend/erp/views_auth.py`. Integrate Django's `send_mail` (SMTP/SendGrid/Resend) to make password recovery fully functional.
2. ✅ **DONE:** **Build the MCP Chat Export Feature**: Resolve `TODO` placeholders in the MCP (AI Agent) module for "Export to PDF/Excel" and "Save as Report". Build utility functions to render chat conversations into downloadable PDFs or structured Excel sheets.
3. ✅ **DONE:** **Dashboard Analytics Enhancements**: Replaced random math and dummy values on the Intelligence Console with live analytical streams from `pos_daily_summary` and `coa` ledgers.
4. ✅ **DONE:** **E-Commerce / Storefront**: Built dynamic subdomain routing to let tenants inject Landing Pages, Catalogs, or Product Stores directly onto their wildcard URL. Engineered a persistent Cart engine and fully connected the React checkout flow to generate live uncaptured Stripe Intents via the Django `ClientMyOrdersViewSet`.
5. ✅ **DONE:** **Supplier Portal**: Constructed the B2B dashboard (`supplier.tsf.ci`) enabling external vendors to view assigned Purchase Orders securely. Engineered the REST API hooks (`acknowledge`, `dispatch_order`) and corresponding React UI to allow Suppliers to physically Accept orders and submit live Carrier Tracking metrics directly into the Tenant's supply chain ledger.
6. 🔧 **IN PROGRESS:** **Organization Setup Wizard**: Multi-step onboarding wizard for first-time organization initialization. Guides new tenants through Business Profile → Financial Setup (Currency, COA Template, Pricing Mode) → Locations & Warehouses → Module Activation → Launch. **Extensible by any agent — see below.**

### 🧩 SETUP WIZARD EXTENSIBILITY (For All Agents)

The Setup Wizard (`/setup-wizard`) is designed to be extended by any module. If your module needs first-time configuration during org onboarding, add a step to the wizard.

**Files:**
- `src/app/(privileged)/setup-wizard/page.tsx` — Server component (data fetching)
- `src/app/(privileged)/setup-wizard/client.tsx` — Client wizard UI (all steps)
- `src/app/actions/setup-wizard.ts` — Server actions (save/fetch data)

**To add a module-specific wizard step:**
1. Add a new step definition to the `STEPS` array in `client.tsx`
2. Create a new `StepMyModule` function component following the existing pattern
3. Add corresponding save action in `setup-wizard.ts`
4. Add the component to the `CurrentStep` rendering array (index must match `STEPS` order)
5. If your module has essential first-time data (e.g., HR → default departments, CRM → contact categories), seed it in the step's save handler

**Candidate steps for future agents:**
- **HR Module**: Default departments, shifts, leave policies
- **CRM Module**: Contact categories, default pricing tiers
- **POS Module**: Default payment methods, receipt templates, register setup
- **E-Commerce**: Storefront theme selection, branding/colors
- **Workspace**: Default task boards, checklist templates

---

## 🛡️ SECURITY HARDENING CHECKLIST
> **Status:** ✅ APPLIED — All critical and important items fixed on 2026-02-24  
> **Audit Date:** 2026-02-24 | **Full Report:** `DOCUMENTATION/CODE_VIOLATIONS_AUDIT.md`

### 🔴 Critical — ALL FIXED ✅

| # | Item | Fix Applied |
|---|------|------------|
| 1 | ✅ **Django DEBUG mode** | Set `DJANGO_DEBUG=False` in `.env` |
| 2 | ✅ **Nginx security headers** | Added 7 headers (X-Frame-Options, CSP, HSTS, nosniff, XSS, Referrer-Policy, Permissions-Policy) |
| 3 | ✅ **Nginx rate limiting** | Added `limit_req` on `/api/auth/login/` (10r/m) and `/api/` (60r/m) |
| 4 | ✅ **Gunicorn bind address** | Changed to `--bind 127.0.0.1:8000` (localhost only) |

### 🟡 Important — MOSTLY FIXED

| # | Item | Status | Details |
|---|------|--------|---------|
| 5 | ✅ **Bare `except:` statements** | FIXED | All 4 replaced with `except Exception:` |
| 6 | ⏳ **MCP models missing tenant isolation** | DEFERRED | 7 models need `TenantModel` — requires migration |
| 7 | ⏳ **MCP ViewSets missing tenant filtering** | DEFERRED | 4 ViewSets need `TenantModelViewSet` — requires testing |
| 8 | ✅ **Hardcoded server IP** | FIXED | Moved to `os.environ.get('EXPECTED_IP_ADDRESSES')` |
| 9 | ⏳ **TypeScript `: any` types** | DEFERRED | 368 occurrences — systematic cleanup ongoing |
| 10 | ⏳ **Redis + Celery not running** | DEFERRED | Requires Redis installation and Celery worker setup |

\n### Setup Wizard Steps Completed:\n- CRM Setup (Pricing Tiers) \n- HR Setup (Departments)\n- POS Setup (Negative Stock Override)\n- eCommerce Setup (Storefront Branding)\n- Workspace Setup (Daily Checklists)
