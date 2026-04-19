---
trigger: always_on
description: Core architecture rules for the Blanc Engine kernel-based platform
---

# Architecture Rules

## 1. Kernel vs Engine Boundary

The platform is a **kernel-based modular system** (like an OS). Understand the boundary:

### Kernel Space (PROTECTED)
- **Path**: `src/app/(privileged)/(saas)/`
- **Contains**: Settings, kernel management, module manager, organization management
- **Rule**: ONLY core infrastructure goes here. If it's OPTIONAL, it's NOT kernel.

### Engine Space (Business Modules)
- **Backend**: `erp_backend/apps/{module_name}/`
- **Frontend**: `src/modules/{module_name}/` (dynamic mounting)
- **Manifest**: Each module has `manifest.json` with sidebar_items, routes, features

### What belongs WHERE

| ✅ Kernel | ❌ NOT Kernel |
|---|---|
| Authentication & authorization | Finance calculations |
| Organization/tenant management | POS, CRM, HR logic |
| Module management & mounting | Third-party integrations |
| Kernel updates & versioning | Custom reports |
| Core settings infrastructure | Domain-specific dashboards |
| Health checks & system status | AI connectors |

## 2. Multi-Tenancy

Every database record MUST belong to exactly ONE organization:
- **All models**: Must have `organization` ForeignKey
- **All queries**: Must filter by `organization_id`
- **API endpoints**: Must derive org from authenticated user context
- **NEVER**: Access another org's data directly — use ConnectorEngine

## 3. Module Communication

Modules MUST NOT import each other directly. Use:

1. **REST APIs** — Endpoints at `/api/{module}/`
2. **ConnectorEngine** — Cross-org and cross-module data routing
3. **Django signals** — Event-based cross-module notifications
4. **Feature flags** — Check `OrganizationModule.is_enabled`
5. **ModelRegistry** — Discover module models without hard imports

## 4. Version Control

Every commit MUST follow semantic versioning:
```
[vMAJOR.MINOR.PATCH-bBUILD] MODULE: Short description
```

- **MAJOR**: Breaking changes
- **MINOR**: New features
- **PATCH**: Bug fixes
- **BUILD**: Incremental within a session

## 5. Documentation

Every page, module, API, or workflow MUST have documentation in `/DOCUMENTATION/` including:
- Goal of the page/module
- Data READ from (which tables)
- Data SAVED to (which tables)
- Variables user interacts with
- Step-by-step workflow

## 6. Single Database Gateway

- **Django is the ONLY service that accesses the database directly**
- Next.js is UI + client logic ONLY — no direct DB access
- All business logic and transactions live in Django
- All data access goes through Django REST APIs
- Financial operations must use database transactions
- No schema changes without Django migrations
- Every API endpoint must document: inputs, outputs, tables touched

## 7. Inter-Agent Handoff

When starting or ending a session:
1. **Read** `.agent/WORK_IN_PROGRESS.md` — see what others did
2. **Read** `.agent/WORKMAP.md` — see pending tasks
3. **Update** both files at session end
4. **Never delete** completed items from WORKMAP — mark as DONE with date

## 8. Agent Bootstrap

Every AI-agent session should start by reading [`.agent/BOOTSTRAP.md`](../BOOTSTRAP.md), which lists the full rule + workflow set and the mandatory first-reply format. Users can paste a single-line bootstrap: `Read and follow .agent/BOOTSTRAP.md before anything else.`

## 9. Kernel OS v2.0 Primitives

The kernel at `erp_backend/kernel/` implements these architecture rules in code via `TenantOwnedModel`, `AuditLogMixin`, `emit_event`, `get_config`, and `@require_permission`. New models and flows should use these primitives.

See [`kernel-os-v2.md`](kernel-os-v2.md) for the full contract and a compatibility table between legacy and OS v2.0 patterns.
