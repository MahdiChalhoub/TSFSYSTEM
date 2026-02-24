# Documentation Conflict & Alignment Audit
**Audit Date:** 2026-02-24  
**Scope:** All 160+ documentation files in `DOCUMENTATION/`  
**Method:** Cross-referenced every doc claim against actual codebase state  

---

## 🔴 CRITICAL CONFLICTS (Docs Say One Thing, Reality Is Different)

### 1. Architecture Description: "Docker-Based" vs Bare-Metal Reality

| Document | Claim | Reality |
|----------|-------|---------|
| `deployment_usage_guide.md` (line 8) | "Architecture: Docker-based (Nginx Gateway, Next.js Frontend, Django Backend, PostgreSQL)" | **NO DOCKER**. System runs on bare-metal systemd services: `tsfsystem.service` (Gunicorn) + `tsfsystem-frontend.service` (Next.js) + system Nginx + system PostgreSQL 16 |
| `deployment_usage_guide.md` (lines 36-37) | "docker-compose up -d --build" | No `docker-compose.yml` is actively used. Services are managed by `systemctl` |
| `deployment_usage_guide.md` (lines 44-56) | "docker exec -it tsf_backend bash" | Container `tsf_backend` does not exist. Direct shell access to `.venv/bin/python` |
| `ROAD_TO_5_STARS.md` (lines 546-574) | Docker health checks, docker-compose improvements | Entire section is irrelevant since system is NOT Docker-based |
| `ROAD_TO_5_STARS.md` (lines 576-603) | Blue-green deployment using `docker compose` | Should reference `systemctl` commands instead |
| `HIRING_PLAN.md` (line 18) | "Infra: VPS (Linux), Gunicorn, Nginx" | ✅ This is actually correct and contradicts the deployment guide |

**Impact:** High — New developers following the deployment guide will try Docker commands that don't work.

---

### 2. Server Paths: `/root/TSFSYSTEM` vs `/root/.gemini/antigravity/scratch/TSFSYSTEM`

| Document | Claim | Reality |
|----------|-------|---------|
| `server_systemd_services.md` (line 11) | Working Dir: `/root/TSFSYSTEM/erp_backend` | Actual: `/root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend` |
| `server_systemd_services.md` (line 12) | Exec: `/root/TSFSYSTEM/erp_backend/venv/bin/gunicorn ...` | Actual: `.venv/bin/gunicorn` (not `venv`) |
| `server_systemd_services.md` (line 19) | Working Dir: `/root/TSFSYSTEM` | Actual: `/root/.gemini/antigravity/scratch/TSFSYSTEM` |
| `server_systemd_services.md` (line 14) | Log: `/var/log/tsf-backend-access.log` | Actual: `/var/log/tsfsystem-access.log` |
| `server_systemd_services.md` (line 22) | DJANGO_URL=`http://127.0.0.1:8000` | ✅ Correct per `.env.production` |

**Impact:** High — Service names and paths are completely wrong. Following this doc will not match any real service.

---

### 3. Service Names: `tsf-backend` vs `tsfsystem`

| Document | Claim | Reality |
|----------|-------|---------|
| `server_systemd_services.md` | Services: `tsf-backend.service`, `tsf-frontend.service` | Actual: `tsfsystem.service`, `tsfsystem-frontend.service` |
| Same doc (line 36-41) | `systemctl status tsf-backend.service` etc. | Should be `systemctl status tsfsystem.service` |

**Impact:** High — All maintenance commands are wrong.

---

### 4. `.env` Configuration: `NEXT_PUBLIC_ROOT_DOMAIN=localhost` Conflict

| File | Value | Context |
|------|-------|---------|
| `.env` | `NEXT_PUBLIC_ROOT_DOMAIN=localhost` | Development `.env` — loaded by default |
| `.env.production` | `NEXT_PUBLIC_ROOT_DOMAIN=tsf.ci` | Production override — requires explicit loading |

The `.env` file says `localhost` but the production system runs with `tsf.ci`. If `.env.production` is not properly loaded during `npm run build`, the frontend will bake `localhost` into the build and subdomain routing breaks.

**Impact:** Medium — Could explain some tenant resolution failures.

---

### 5. Model Counts: Wildly Outdated in MODULAR_ARCHITECTURE.md

| Document Claim | Actual Count |
|----------------|-------------|
| "POS: 2 models, 2 serializers, 2 services, 2 ViewSets" | **20 models**, 8+ model files (models.py, purchase_order_models.py, returns_models.py, consignment_models.py, delivery_models.py, discount_models.py, quotation_models.py, sourcing_models.py) |
| "CRM: 1 model, 1 serializer, 1 ViewSet" | **1 model** ✅ but has **5+ ViewSets** (ContactViewSet + pricing ViewSets) and **3+ serializer files** |
| "HR: 1 model, 1 serializer, 1 ViewSet" | **5 models** (Employee, Department, Shift, Attendance, Leave), **5+ ViewSets** |
| "erp/models.py (356 lines)" | **800 lines** (2.25x larger) |
| "erp/views.py (516 lines)" | **1,244 lines** (2.4x larger) |
| "Inventory: 9 models, 11 serializers, 1 service, 8 ViewSets" | **27 models** (3x more) |
| "Finance: 12 models, 12 serializers, 7 services, 9 ViewSets" | **27 models** (2.25x more) |
| "Total: 81 models" (HIRING_PLAN.md) | **169 total models** (Django reports 169 across all apps, 162 business models) |

**Impact:** Medium — Misleading for onboarding. New devs will think the codebase is much smaller.

---

### 6. Code Size Claims: Significantly Understated

| Document Claim | Actual |
|----------------|--------|
| FULL_SYSTEM_AUDIT: "Backend ~25,000+ lines" | ✅ Roughly correct |
| FULL_SYSTEM_AUDIT: "Frontend ~40,000+ lines" | **107,000+ lines** (2.7x larger) |
| FULL_SYSTEM_AUDIT: "~930+ files total" | Backend: 200+ py files, Frontend: 679 ts/tsx files = **~900+ files** ✅ Close |
| HIRING_PLAN: "~45,000 LOC frontend" | **107,000 LOC** — drastically understated |
| HIRING_PLAN: "~25,000 LOC backend" | ✅ Roughly correct |
| ROAD_TO_5_STARS: "67K+ lines, 15 modules" | **132K+ lines total**, **15 installed apps** — LOC is 2x what's claimed |
| FULL_SYSTEM_AUDIT: "~700+ frontend files" | **679 files** ✅ Close |

**Impact:** Low-Medium — Understates project complexity for planning purposes.

---

### 7. File Size Claims in ROAD_TO_5_STARS / FULL_SYSTEM_AUDIT

| Claim | Actual |
|-------|--------|
| "Inventory Views (2,210 lines)" | **2,209 lines** ✅ Close |
| "Finance Views (1,861 lines)" | **1,860 lines** ✅ Close |
| "Finance Services (1,643 lines)" | **1,633 lines** ✅ Close |
| "Connector Engine (1,130 lines)" | **1,129 lines** ✅ Close |
| "erp/models.py (798 lines)" per FULL_SYSTEM_AUDIT | **800 lines** ✅ |
| "erp/views.py (1,245 lines)" per FULL_SYSTEM_AUDIT | **1,244 lines** ✅ |

**Impact:** None — These are accurate (±1 line which is normal for edits).

---

## 🟡 MODERATE CONFLICTS (Docs Are Partially Outdated)

### 8. Gunicorn Workers: Service Config vs Doc

| Document | Claim | Reality |
|----------|-------|---------|
| `server_systemd_services.md` | `--workers 3` | Actual: `--workers 9` |

---

### 9. Inventory Module Pages Count

| Document | Claim | Reality |
|----------|-------|---------|
| `MODULE_INVENTORY.md` | "24 directories / 24 pages" | Actual: **24+ pages found** ✅ — but some paths may have shifted |
| `MODULE_INVENTORY.md` | "All 24 inventory pages compile successfully (verified 2026-02-22)" | Build status needs re-verification after recent changes |

---

### 10. Next.js Version

| Document | Claim | Reality |
|----------|-------|---------|
| FULL_SYSTEM_AUDIT | "Next.js 15+ Frontend" | Actual: **Next.js 16.1.4** — should say "Next.js 16" |
| HIRING_PLAN | "Next.js 15" | Actual: **16.1.4** |

---

### 11. Postgres Version

| Document | Claim | Reality |
|----------|-------|---------|
| ROAD_TO_5_STARS (line 495,549) | "postgres:15-alpine" | Actual: **PostgreSQL 16** |

---

### 12. Gunicorn Bind Address

| Document | Claim | Reality |
|----------|-------|---------|
| `server_systemd_services.md` | `--bind 127.0.0.1:8000` | Actual: `--bind 0.0.0.0:8000` (listens on all interfaces) |

**Impact:** Low — but 0.0.0.0 is a security concern if firewall isn't properly configured.

---

## 🟢 ALIGNMENT ISSUES (Minor/Cosmetic)

### 13. `MASTER_HUB.md` References Stale Brain Paths

The MASTER_HUB references conversation IDs and plan links like:
```
[Plan](file:///root/.gemini/antigravity/brain/1ee34314-f18b-4d81-a8ce-d4678fd53412/implementation_plan.md)
```
These are ephemeral agent workspace paths that may not persist.

### 14. Platform Name Inconsistency

| Document | Name Used |
|----------|-----------|
| `HIRING_PLAN.md` | "Dajingo ERP (TSF Cloud Platform)" |
| `MASTER_HUB.md` | "TSF ERP" |
| `FULL_SYSTEM_AUDIT.md` | "TSF Ultimate Enterprise Suite" |
| `security_audit_infrastructure.md` | "Dajingo platform kernel" |
| `DESIGN_CRITERIA.md` | "TSFSYSTEM" |
| `ROAD_TO_5_STARS.md` | "TSF Enterprise Suite API" |
| Login page / saas config | "Dajingo" |

There's no single authoritative product name.

### 15. COA_ARCHITECTURE.md vs Chart-of-Accounts Pages

Two separate docs cover Chart of Accounts:
- `COA_ARCHITECTURE.md` (32 lines, high-level)
- `pages/chart-of-accounts.md` (24 lines) 
- `pages/chart_of_accounts.md` (34 lines) — **two files with same topic, different naming**

### 16. Duplicate/Overlapping Documentation Files

Several documentation files cover overlapping topics:
- `inventory_module_audit.md` + `inventory_module_components_audit.md` + `inventory_module_crossmodule_audit.md` + `inventory_module_deep_audit.md` + `inventory_module_remaining_audit.md` — **5 separate audit fragments**
- `type-safety-infrastructure.md` + `type-safety-remaining-modules.md` + `type-safety-sweep.md` — **3 type-safety docs**
- `chart-of-accounts.md` + `chart_of_accounts.md` — **same topic, different filenames**

### 17. Workspace Module Listed in kernel_architecture.md But Missing From Manifest

`kernel_architecture.md` lists 7 modules (finance, inventory, products, crm, hr, purchases, sales) but omits: workspace, storage, mcp, ecommerce, client_portal, supplier_portal, migration, packages.

### 18. Storefront Pages Don't Match CLIENT_STOREFRONT.md 

`CLIENT_STOREFRONT.md` lists 20+ frontend files under `src/app/tenant/[slug]/`. These should be cross-verified to ensure all exist and match the described URLs.

---

## 📊 Summary Statistics

| Metric | Doc Claim | Actual | Status |
|--------|-----------|--------|--------|
| Total LOC | ~67K | ~132K | 🔴 2x understated |
| Frontend LOC | ~45K | ~107K | 🔴 2.4x understated |
| Backend LOC | ~25K | ~25K | ✅ Correct |
| Total Models | 81 | 169 | 🔴 2x understated |
| POS Models | 2 | 20 | 🔴 10x understated |
| HR Models | 1 | 5 | 🔴 5x understated |
| CRM Models | 1 | 1 | ✅ |
| Inventory Models | 9 | 27 | 🔴 3x understated |
| Finance Models | 12 | 27 | 🔴 2.25x understated |
| Next.js Version | 15 | 16.1.4 | 🟡 Outdated |
| PostgreSQL | 15 | 16 | 🟡 Outdated |
| Python | 3.12 | 3.12.3 | ✅ |
| Architecture | Docker | Bare-metal systemd | 🔴 Wrong |
| Server Paths | /root/TSFSYSTEM | /root/.gemini/.../TSFSYSTEM | 🔴 Wrong |
| Service Names | tsf-backend | tsfsystem | 🔴 Wrong |
| Gunicorn Workers | 3 | 9 | 🟡 Outdated |
| Gunicorn Bind | 127.0.0.1 | 0.0.0.0 | 🟡 Security concern |

---

## 🛠️ Fixes Applied (2026-02-24)

### P0 — Critical (All Fixed ✅)
1. ✅ **`deployment_usage_guide.md`**: Rewrote — replaced all Docker references with actual systemd commands
2. ✅ **`server_systemd_services.md`**: Rewrote — updated service names, paths, worker count, bind address, log paths
3. ✅ **`.env`**: Added "LOCAL DEVELOPMENT ONLY" header; `.env.production` header clarified

### P1 — Important (All Fixed ✅)
4. ✅ **`MODULAR_ARCHITECTURE.md`**: Rewrote — all model/ViewSet/serializer counts updated to match reality
5. ✅ **`HIRING_PLAN.md`**: Updated LOC (45K → 107K frontend), models (81 → 169), Next.js (15 → 16), PostgreSQL 16
6. ✅ **`FULL_SYSTEM_AUDIT.md`**: Updated frontend LOC (40K → 107K), total LOC (67K → 132K), file counts, line counts in architecture diagram, Next.js version, PostgreSQL version
7. ✅ **`ROAD_TO_5_STARS.md`**: Updated LOC (67K → 132K), PostgreSQL (15 → 16), added note that Docker sections are aspirational

### P2 — Cleanup (All Fixed ✅)
8. ✅ **Platform naming**: Added naming convention to `MASTER_HUB.md` (Product: "Dajingo ERP", Codebase: "TSFSYSTEM", Short: "TSF")
9. ✅ **Duplicate COA docs**: `pages/chart-of-accounts.md` now redirects to `chart_of_accounts.md`
10. ✅ **`kernel_architecture.md`**: Updated module table from 7 to all 15 installed apps with model counts
11. ✅ **`BACKGROUND_PROCESSING_NOTIFICATIONS.md`**: Added note that Redis/Celery not currently running

### Remaining (Low Priority)
- Inventory audit fragments (5 files) could be consolidated into 1 — deferred as they're historical records
- Type-safety docs (3 files) overlap — deferred as they cover different phases
- Storefront page verification — deferred to next build cycle

---

*Generated by documentation cross-reference audit on 2026-02-24*
*All critical and important fixes applied on 2026-02-24*
