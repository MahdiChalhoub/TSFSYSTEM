# TSFSYSTEM — Enterprise Resource Planning System

> Multi-tenant, modular ERP built with **Next.js 15** (frontend) and **Django REST Framework** (backend).  
> Finance-grade accounting, POS terminal orchestration, inventory management, CRM, procurement, and HR — in a single monorepo.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript |
| **Backend** | Django 5, DRF, Celery, PostgreSQL |
| **Styling** | CSS Variables (400+ `--app-*` tokens), 7 themes |
| **Auth** | JWT + session-based, multi-tenant middleware |
| **Infra** | Docker, Gunicorn, Nginx, Cloudflare |

---

## Monorepo Map

```
TSFSYSTEM/
├── src/                          ← Frontend source of truth
│   ├── app/(privileged)/         ← Admin pages (200+)
│   ├── app/actions/              ← Server actions (V2 standard)
│   ├── components/               ← Shared UI components
│   ├── contexts/                 ← Theme/auth/design providers
│   ├── hooks/                    ← Custom hooks
│   ├── lib/                      ← API client (erpFetch), utilities
│   ├── styles/                   ← Global CSS + layout system
│   └── types/                    ← TypeScript definitions
│
├── erp_backend/                  ← Backend source of truth
│   ├── apps/                     ← Django modules
│   │   ├── finance/              ← Accounting, tax, ledger
│   │   ├── pos/                  ← POS terminal + orders
│   │   ├── inventory/            ← Stock, warehouse, movements
│   │   ├── crm/                  ← Contacts, pricing, loyalty
│   │   ├── hr/                   ← Employees, WISE scoring
│   │   ├── sales/                ← Quotations, sales pipeline
│   │   ├── ecommerce/            ← Client-facing storefront
│   │   └── saas/                 ← Multi-tenancy engine
│   ├── core/                     ← Settings, middleware, auth
│   ├── erp/                      ← URL routing, ASGI
│   └── kernel/                   ← ConnectorEngine, events
│
├── docs/                         ← Documentation
│   ├── architecture/             ← System design docs
│   ├── deployment/               ← Deploy guides, infra docs
│   ├── audits/                   ← Audit reports, checklists
│   └── runbooks/                 ← Module-specific guides
│
├── tools/                        ← Operational scripts
│   ├── deploy/                   ← Deploy/sync scripts
│   ├── recovery/                 ← Migration fixes, schema repair
│   ├── debug/                    ← Diagnostic utilities
│   ├── seeding/                  ← Sample data injection
│   └── refactors/                ← One-time refactoring scripts
│
├── scripts/                      ← CI/CD and automation
├── .agents/workflows/            ← Agent workflow definitions
└── tests/                        ← Integration tests
```

### Source of Truth
- **`src/`** — all frontend code lives here, nowhere else
- **`erp_backend/apps/`** — all backend logic lives here
- **`erp_backend/kernel/`** — ConnectorEngine + event system
- Everything outside these is tooling, documentation, or infrastructure

---

## Quick Start

### Prerequisites
- Node.js 20+, Python 3.12+, PostgreSQL 16+

### Frontend
```bash
npm install
npm run dev          # → http://localhost:3000
```

### Backend
```bash
cd erp_backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver  # → http://localhost:8000
```

### Both (Docker)
```bash
docker-compose up
```

---

## Module Communication Law

> **No module may directly import from another module.**

All cross-module communication goes through the **ConnectorEngine** (`erp_backend/kernel/`):

```python
# ✅ CORRECT — use ConnectorEngine
from kernel.connector_engine import ConnectorEngine
ConnectorEngine.route("finance.post_journal_entry", data)

# ❌ FORBIDDEN — direct cross-module import
from apps.finance.services import post_entry
```

See [/connector-governance](/.agents/workflows/connector-governance.md) workflow for full rules.

---

## Testing

```bash
# Backend tests
cd erp_backend
python -m pytest --cov=apps --cov-report=term-missing

# Frontend build check
npm run build
```

**Coverage targets:**
- Finance/posting/tax: 80%+ (P1)
- All other modules: 60%+ (current: 50% minimum)

---

## Deployment

See the [/deploy-dev](/.agents/workflows/deploy-dev.md) workflow for the standard deployment process.

**Production:** `deploy_hotfix.sh` (root) — the active deployment script.

---

## Active vs Legacy Policy

| Directory | Status | Description |
|-----------|--------|-------------|
| `src/`, `erp_backend/apps/` | **Active** | Source of truth |
| `docs/` | **Active** | Maintained documentation |
| `tools/` | **Active** | Operational scripts |
| `scripts/` | **Active** | CI/CD automation |
| `_quarantine/` | **Legacy** | Under review for deletion |
| `_quarantine/uncertain/` | **Review** | Session docs, may be deleted |

### Repo Hygiene Rules
1. No file > 10MB committed without explicit approval
2. No `.env`, `.sqlite3`, `.sql`, media in git
3. Root file count must stay ≤ 25
4. Backend root file count must stay ≤ 15
5. All new documentation goes to `docs/`
6. All scripts go to `tools/` or `scripts/`
