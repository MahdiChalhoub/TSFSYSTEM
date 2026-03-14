# Dajingo ERP — Engineering Team Hiring Plan

> **From**: CTO / VP Engineering  
> **Date**: February 19, 2026  
> **Project**: Dajingo ERP (TSF Cloud Platform)  
> **Current State**: Codebase audited, production-hardened, zero technical debt  
> **Goal**: Ship 15 features across 4 phases in 8-12 weeks  

---

## Current Architecture (What They're Walking Into)

| Layer | Stack | Lines of Code |
|-------|-------|---------------|
| Frontend | Next.js 16, TypeScript, Server Actions | ~107,000 |
| Backend | Django 5, DRF, Multi-Tenant | ~25,000 |
| Database | PostgreSQL 16, Multi-Org Isolation | 169 models |
| Infra | VPS (Linux), Gunicorn, Nginx, systemd | Single Linux server |

**Key conventions**: Server Actions pattern, `erpFetch` API layer, `AuditLogMixin`, `TenantFilterMixin`, modular architecture (Engine → Kernel → Core → Modules).

---

## Who To Hire (6 Engineers)

---

### 🔴 HIRE #1: Senior Backend Engineer (Django/DRF)
**Priority**: Immediate — blocks everything  
**Salary Range**: $80K-$120K/yr (or $50-70/hr contract)

**Why**: The entire Phase 1 (Invoice, Payment, PO, Stock Alerts) is backend-heavy. These are complex domain models with state machines, financial calculations, and multi-tenant isolation. You need someone who *thinks in Django* and understands double-entry accounting.

**Must-Have Skills**:
- Django + Django REST Framework (3+ years)
- PostgreSQL — migrations, constraints, transactions
- Financial/ERP domain experience (invoicing, payments, ledger)
- State machine patterns (FSM)
- Writing serializers with custom validation

**Their Roadmap (First 6 Weeks)**:
| Week | Task | Output |
|------|------|--------|
| 1 | Onboarding + Codebase study | Understands tenant isolation, mixins, event bus |
| 2-3 | **1.1 Invoice Model** | `Invoice`, `InvoiceLine` models, serializers, ViewSet, URLs |
| 3-4 | **1.2 Payment Model** | `Payment`, `PaymentAllocation`, auto-status transitions |
| 5 | **1.3 Purchase Order** | `PurchaseOrder` model, 10-state machine, ViewSet |
| 6 | **1.4 Stock Alerts** | `StockAlert` model, reorder logic, alert service |

**Files they'll create**:
```
erp_backend/apps/finance/invoice_models.py
erp_backend/apps/finance/payment_models.py
erp_backend/apps/finance/invoice_serializers.py
erp_backend/apps/finance/invoice_views.py
erp_backend/apps/pos/purchase_order_models.py
erp_backend/apps/inventory/alert_models.py
```

**Success criteria**: All 4 models with full CRUD, lifecycle transitions, and passing `manage.py check`.

---

### 🔴 HIRE #2: Mid-Level Full-Stack Engineer (Next.js + Django)
**Priority**: Immediate — works in parallel with Hire #1  
**Salary Range**: $60K-$90K/yr (or $35-55/hr contract)

**Why**: Every backend model needs a frontend. This person builds the UI pages, server actions, and integrates with the backend APIs as they're delivered by Hire #1.

**Must-Have Skills**:
- Next.js 14/15 (App Router, Server Actions, Server Components)
- TypeScript (strict mode)
- React — forms, state management, data tables
- REST API consumption
- Tailwind or Vanilla CSS

**Their Roadmap (First 6 Weeks)**:
| Week | Task | Output |
|------|------|--------|
| 1 | Onboarding + Pattern study | Understands Server Actions, `erpFetch`, page patterns |
| 2-3 | **Invoice Pages** | List, Detail, Create pages + server actions |
| 3-4 | **Payment UI** | Record Payment dialog, payment history, allocation UI |
| 5 | **Purchase Order Pages** | PO list, detail with state transitions, create |
| 6 | **Stock Alerts Dashboard** | Low stock report, alert settings, dashboard widget |

**Files they'll create**:
```
src/app/actions/finance/invoices.ts
src/app/(privileged)/(modules)/finance/invoices/page.tsx
src/app/(privileged)/(modules)/finance/invoices/[id]/page.tsx
src/app/actions/finance/payments.ts
src/app/(privileged)/(modules)/finance/purchase-orders/page.tsx
```

**Success criteria**: All 4 features have working UI with create, list, detail, and lifecycle actions.

---

### 🟠 HIRE #3: Backend Infrastructure Engineer (DevOps + Django)
**Priority**: Week 3 — needed after Phase 1 foundation exists  
**Salary Range**: $70K-$100K/yr (or $45-60/hr contract)

**Why**: Phase 2 (Celery + Notifications) is pure infrastructure. This person sets up background task processing, scheduled jobs, and multi-channel notifications. Without this, invoices can't auto-detect overdue status, stock alerts can't fire, and reports can't be scheduled.

**Must-Have Skills**:
- Celery + Redis (task queues, beat scheduling)
- Django signals and async tasks
- Email delivery (SMTP, SendGrid, Mailgun)
- Linux server administration
- Docker (nice to have for Redis)

**Their Roadmap (4 Weeks)**:
| Week | Task | Output |
|------|------|--------|
| 1 | **Celery Setup** | `celery.py`, worker config, Redis, beat schedule |
| 2 | **Background Tasks** | Overdue invoice checker, stock alert scanner, log cleanup |
| 3 | **Notification Engine** | Notification model expansion (channels), email service |
| 4 | **Notification Templates** | Template model, preference model, frontend settings page |

**Files they'll create**:
```
erp_backend/celery.py
erp_backend/erp/tasks.py
erp_backend/erp/notification_service.py
erp_backend/erp/notification_models.py
```

**Success criteria**: Celery worker running, beat schedule active, email notifications firing on overdue invoices.

---

### 🟡 HIRE #4: Mid-Level Frontend Engineer (React/Next.js)
**Priority**: Week 4 — Phase 3 UI work  
**Salary Range**: $55K-$80K/yr (or $30-50/hr contract)

**Why**: Phase 3 has 5 features (CRM, Suppliers, Categories, Warehouse, HR) — Hire #2 can't build all of them alone. This person handles the module enrichment UI while Hire #2 focuses on integrations.

**Must-Have Skills**:
- React + Next.js (App Router)
- TypeScript
- Data visualization (charts, dashboards)
- Form design and validation (Zod)
- Responsive CSS

**Their Roadmap (5 Weeks)**:
| Week | Task | Output |
|------|------|--------|
| 1 | **CRM Enhancement** | Customer profile with lifetime value, purchase history charts |
| 2 | **Supplier Scorecard** | Rating system, performance metrics page |
| 3 | **Category Tree** | Enhanced tree view with counts, barcode sequences |
| 4 | **Warehouse Layout** | Zone/aisle/rack/bin UI, location assignment |
| 5 | **HR Pages** | Attendance, leave requests, department tree |

**Success criteria**: All 5 module pages live with real data, responsive, matching the existing design system.

---

### 🟡 HIRE #5: Mid-Level Backend Engineer (Django)
**Priority**: Week 4 — Phase 3 backend work  
**Salary Range**: $55K-$80K/yr (or $30-50/hr contract)

**Why**: The Phase 3 backend (CRM analytics, supplier ratings, warehouse locations, HR models) needs its own dedicated engineer while Hire #1 moves to Phase 4 integrations.

**Must-Have Skills**:
- Django + DRF
- PostgreSQL (computed fields, signals)
- Data modeling (hierarchical data, analytics aggregations)
- Django signals and model lifecycle hooks

**Their Roadmap (5 Weeks)**:
| Week | Task | Output |
|------|------|--------|
| 1 | **CRM Backend** | Analytics fields, lifetime value computation, loyalty service |
| 2 | **Supplier Backend** | Ratings model, performance auto-compute on PO changes |
| 3 | **Category Backend** | Auto-computed `level`, `full_path`, `products_count` |
| 4 | **Warehouse Backend** | Zone/Aisle/Rack/Shelf/Bin models, ProductLocation |
| 5 | **HR Backend** | Department, Attendance, Leave, Shift models + ViewSets |

**Success criteria**: All 5 backend APIs live with proper serializers, tests, and tenant isolation.

---

### 🔵 HIRE #6: Integration/Senior Engineer (APIs + Payments)
**Priority**: Week 6 — Phase 4 requires seniority  
**Salary Range**: $90K-$130K/yr (or $55-75/hr contract)

**Why**: Phase 4 (Stripe, Shopify/WooCommerce, ZATCA e-invoicing, Report Builder) involves third-party integrations with security implications (encrypted API keys, PCI compliance, government certification). This requires a senior engineer who has shipped payment integrations before.

**Must-Have Skills**:
- Stripe API (Payment Intents, Checkout, Webhooks)
- E-commerce APIs (Shopify Admin API, WooCommerce REST)
- Government API compliance (ZATCA/FNE is a plus, but any e-invoicing experience works)
- Encryption and key management
- PDF generation (ReportLab, WeasyPrint)

**Their Roadmap (4 Weeks)**:
| Week | Task | Output |
|------|------|--------|
| 1 | **Stripe Integration** | Gateway model, checkout flow, webhook handler |
| 2 | **E-commerce Sync** | Shopify/WooCommerce connector, product sync, order import |
| 3 | **ZATCA/FNE** | E-invoicing certification service, compliance fields |
| 4 | **Report Builder** | Dynamic query builder, PDF/Excel export, scheduled reports |

**Success criteria**: End-to-end payment flow working, product sync operational, compliance-ready invoice XML.

---

## Team Structure

```
                    ┌──────────────┐
                    │  CTO / You   │
                    │  (Architect) │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────┴──────┐ ┌────┴────┐ ┌───────┴───────┐
     │  Backend    │ │ Frontend│ │    Infra       │
     │  Team Lead  │ │  Lead   │ │  Engineer      │
     │  (Hire #1)  │ │(Hire #2)│ │  (Hire #3)     │
     └──────┬──────┘ └────┬────┘ └───────────────┘
            │              │
     ┌──────┴──────┐ ┌────┴────┐
     │  Backend    │ │Frontend │
     │  Engineer   │ │Engineer │
     │  (Hire #5)  │ │(Hire #4)│
     └─────────────┘ └─────────┘
            │
     ┌──────┴──────┐
     │ Integration │
     │  Senior     │
     │  (Hire #6)  │
     └─────────────┘
```

---

## Hiring Timeline

```
Week 0  ──► Hire #1 (Sr Backend) + Hire #2 (Full-Stack)     ← START HERE
Week 3  ──► Hire #3 (Infra/DevOps)
Week 4  ──► Hire #4 (Frontend) + Hire #5 (Backend)
Week 6  ──► Hire #6 (Integration Senior)
Week 12 ──► All 15 features shipped ✅
```

---

## Budget Summary

| Hire | Role | Monthly Cost (Est.) | Duration |
|------|------|--------------------:|----------|
| #1 | Sr Backend (Django) | $8K-$10K | 12 weeks |
| #2 | Full-Stack (Next.js) | $5K-$7.5K | 12 weeks |
| #3 | Infra (Celery/DevOps) | $6K-$8K | 8 weeks |
| #4 | Frontend (React) | $4.5K-$6.5K | 8 weeks |
| #5 | Backend (Django) | $4.5K-$6.5K | 8 weeks |
| #6 | Integration Senior | $7.5K-$11K | 6 weeks |
| | **Total (12 weeks)** | **$36K-$50K** | |

> 💡 **Cost Optimization**: Hires #3-#6 are staggered. You're never paying all 6 simultaneously. Peak spend is weeks 6-8 (5 engineers active).

---

## What YOU (CTO) Do

Your role is **NOT coding** — it's:

1. **Code Review**: Review every PR before merge. You know the architecture best.
2. **Architecture Decisions**: Define how Invoice→Payment→PO models relate. Write the ERD.
3. **Sprint Planning**: Weekly 30-min standups. Assign tasks from `MASTER_IMPLEMENTATION_PLAN.md`.
4. **API Contract Definition**: Define the API schemas BEFORE engineers start (prevents rework).
5. **Quality Gate**: Run `npx next build` + `manage.py check` before any merge.
6. **Deployment**: You control production deploys. No one else pushes to main.

---

## Onboarding Checklist (All Hires)

Every engineer gets this on Day 1:

- [ ] Read `DOCUMENTATION/deep-audit.md` — understand the codebase state
- [ ] Read `MASTER_IMPLEMENTATION_PLAN.md` — understand what they're building
- [ ] Read `DOCUMENTATION/PRODUCTION_READINESS_AUDIT_REPORT.md` — understand quality standards
- [ ] Study `.agent/workflows/engine.md` — understand the dev workflow
- [ ] Run the app locally (frontend + backend)
- [ ] Make a dummy PR to prove they can build, test, and push
- [ ] Receive their specific phase assignment with deadlines

---

## Rules for All Engineers

1. **Every commit** must follow: `[vX.X.X-bXXX] MODULE: Description`
2. **Every feature** must have documentation in `/DOCUMENTATION/`
3. **No bare `except:`** — specific exceptions only
4. **No `any` types** in TypeScript — strict typing enforced
5. **No hardcoded secrets** — use environment variables
6. **No direct DB access** from frontend — Server Actions → `erpFetch` → Django API only
7. **Multi-tenant isolation** — every model must use `TenantFilterMixin`
8. **Build must pass** before PR submission (`npx next build` exit code 0)
