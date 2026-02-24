# Code Violations Audit — Against Documented Standards
**Audit Date:** 2026-02-24  
**Standards Checked:** `global_technical_standards.md`, `DESIGN_CRITERIA.md`, `HIRING_PLAN.md` (Rules for All Engineers), `ROAD_TO_5_STARS.md` (Security Checklist)  

---

## 🔴 CRITICAL VIOLATIONS

### 1. `DJANGO_DEBUG=True` in `.env` (ACTIVE in production)

**Rule Violated:** Security Protocol — Production must never expose debug info  
**File:** `.env` line 15  
**Current:** `DJANGO_DEBUG=True`  
**Risk:** Django debug mode exposes full stack traces, SQL queries, settings, and server paths to anyone who triggers a 500 error. This is the **#1 most dangerous setting** in any Django deployment.  
**Actual runtime status:** The `.env` is loaded by Django if no other env file overrides it. The `settings.py` reads: `DEBUG = os.getenv('DJANGO_DEBUG', 'False').lower() in ('true', '1')` — so **DEBUG IS ON** unless a separate mechanism overrides it.

**Fix Required:** Set `DJANGO_DEBUG=False` in `.env`, or better yet, remove it from `.env` entirely so the default `False` applies.

---

### 2. Nginx: ZERO Security Headers

**Rule Violated:** `ROAD_TO_5_STARS.md` Security Checklist — "Nginx security headers (7 headers)"  
**File:** `/etc/nginx/sites-enabled/default`  
**Current:** 0 `add_header` directives found  
**Missing:**
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` — legacy XSS protection
- `Content-Security-Policy` — prevents script injection
- `Strict-Transport-Security` — enforces HTTPS
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — restricts browser features

---

### 3. Nginx: ZERO Rate Limiting

**Rule Violated:** `global_technical_standards.md` — "Rate limiting on sensitive endpoints"  
**File:** `/etc/nginx/sites-enabled/default`  
**Current:** 0 `limit_req` directives  
**Risk:** No protection against brute-force login attacks, API abuse, or DDoS on the `/api/auth/login/` endpoint.

---

### 4. Gunicorn Binds to `0.0.0.0:8000`

**Rule Violated:** Security best practice — internal services should only listen on localhost  
**File:** `/etc/systemd/system/tsfsystem.service`  
**Current:** `--bind 0.0.0.0:8000`  
**Risk:** The Django API is accessible on ALL network interfaces. If there's no firewall blocking port 8000, anyone on the internet can directly hit the backend, bypassing Nginx (and all its security headers/rate limiting).  
**Fix Required:** Change to `--bind 127.0.0.1:8000`

---

## 🟡 MODERATE VIOLATIONS

### 5. 368 Uses of `: any` Type in TypeScript (148 files)

**Rule Violated:** `HIRING_PLAN.md` Rule #4 — "No `any` types in TypeScript — strict typing enforced"  
**Files Affected:** 148 files, 368 occurrences  
**Worst offenders (by sample):**
- `src/lib/utils/tree.ts` — `buildTree(items: any[])`
- `src/components/pos/layouts/*.tsx` — `cart.map((item: any) => ...)`  
- `src/components/pos/TicketSidebar.tsx` — `client: any`
- `src/types/pos-layout.ts` — `deliveryZones: any[]`

**Impact:** Defeats TypeScript's type safety. Bugs can slip through that the compiler would otherwise catch.

---

### 6. 4 Bare `except:` Statements

**Rule Violated:** `HIRING_PLAN.md` Rule #3 — "No bare `except:` — specific exceptions only"  
**Locations:**
| File | Line |
|------|------|
| `erp/views_saas_modules.py` | 1148 — `except: continue` |
| `apps/client_portal/models.py` | 179 — `except:` |
| `apps/client_portal/views.py` | 920 — `except:` |
| `erp_backend/verify_zatca.py` | 353 — `except:` |

**Risk:** Swallows all exceptions silently, including `SystemExit`, `KeyboardInterrupt`, and programming errors.

---

### 7. 16 Models NOT Using `TenantModel`

**Rule Violated:** `HIRING_PLAN.md` Rule #7 — "Multi-tenant isolation — every model must use `TenantFilterMixin`"  
| App | Model | Base Class |
|-----|-------|-----------|
| `packages` | PackageUpload | `models.Model` |
| `storage` | StorageProvider | `models.Model` |
| `storage` | UploadSession | `models.Model` |
| `migration` | MigrationMapping | `models.Model` |
| `inventory` | StockAdjustmentLine | `models.Model` |
| `inventory` | StockTransferLine | `models.Model` |
| `inventory` | OperationalRequestLine | `models.Model` |
| `inventory` | InventorySessionLine | `models.Model` |
| `core` | SystemSetting | `models.Model` |
| `mcp` | MCPProvider | `models.Model` |
| `mcp` | MCPTool | `models.Model` |
| `mcp` | MCPConnection | `models.Model` |
| `mcp` | MCPConversation | `models.Model` |
| `mcp` | MCPMessage | `models.Model` |
| `mcp` | MCPUsageLog | `models.Model` |
| `mcp` | MCPRateLimit | `models.Model` |

**Note:** Some of these may be intentional (e.g., `SystemSetting` is global, `StockAdjustmentLine` is a child of a tenant-scoped parent). But the MCP models (7 models) are a **real concern** — they need tenant isolation or any org can see another org's AI conversations.

---

### 8. 30+ ViewSets NOT Using `TenantModelViewSet`

**Rule Violated:** Multi-tenant isolation standard  
**Key violators:**
- All **MCP ViewSets** (MCPProviderViewSet, MCPToolViewSet, MCPConversationViewSet, MCPUsageLogViewSet) — use `viewsets.ModelViewSet` directly
- All **Client Portal ViewSets** (ClientDashboardViewSet, ClientMyOrdersViewSet, ClientWalletViewSet) — use `viewsets.ModelViewSet` or `viewsets.ViewSet`
- All **Supplier Portal ViewSets** — same pattern
- `POS ViewSets` (POSViewSet, PurchaseViewSet) — use `viewsets.ViewSet`
- All **Workspace ViewSets** — use `TenantFilterMixin` but NOT `TenantModelViewSet`

**Note:** Workspace uses `TenantFilterMixin` directly which provides the same filtering — this is acceptable. But portal ViewSets and MCP ViewSets may leak data across tenants.

---

### 9. Hardcoded IP Address in Code

**Rule Violated:** `HIRING_PLAN.md` Rule #5 — "No hardcoded secrets — use environment variables"  
**File:** `erp/tasks_domains.py` line 50  
**Code:** `EXPECTED_IP_ADDRESSES = ['91.99.186.183']`  
**Fix:** Move to environment variable: `os.getenv('EXPECTED_IP_ADDRESSES', '').split(',')`

---

## 🟢 PASSING CHECKS (No Violations Found)

| Check | Status | Details |
|-------|--------|---------|
| SECRET_KEY in environment variable | ✅ PASS | `os.getenv('DJANGO_SECRET_KEY')` with dev fallback only when `DEBUG=True` |
| CORS not open to all | ✅ PASS | `CORS_ALLOW_ALL_ORIGINS` defaults to `False`, specific origins listed |
| ALLOWED_HOSTS properly set | ✅ PASS | Set via env var, defaults include `.tsf.ci` wildcard |
| `.env` not committed to git | ✅ PASS | `.gitignore` excludes `.env` and `.env.local` |
| `.env.production` in git | ✅ PASS | Intentionally committed (contains no secrets, only domain config) |
| No GitHub tokens in code | ✅ PASS | No `ghp_` or `github_pat_` found |
| No raw SQL | ✅ PASS | No `.raw()` or `cursor()` calls found in app code |
| ORM enforced | ✅ PASS | All data access through Django ORM |

---

## 📊 Summary

| Severity | Count | Items |
|----------|-------|-------|
| 🔴 Critical | 4 | DEBUG=True, no nginx headers, no rate limiting, gunicorn 0.0.0.0 |
| 🟡 Moderate | 5 | 368 any types, 4 bare except, 16 non-tenant models, 30+ non-tenant ViewSets, hardcoded IP |
| 🟢 Pass | 8 | SECRET_KEY, CORS, ALLOWED_HOSTS, .env exclusion, no tokens, no raw SQL |

---

## 🛠️ Priority Fix Order

### Immediate (minutes)
1. Set `DJANGO_DEBUG=False` in `.env`
2. Change Gunicorn bind to `127.0.0.1:8000`

### Today (30 min)
3. Add Nginx security headers (7 headers)
4. Add Nginx rate limiting on `/api/auth/login/`

### This Week
5. Fix 4 bare `except:` statements
6. Add `TenantFilterMixin` to MCP models and ViewSets
7. Move hardcoded IP to environment variable

### Ongoing
8. Systematic `: any` type elimination (148 files)

---

*Generated by code violations audit on 2026-02-24*
