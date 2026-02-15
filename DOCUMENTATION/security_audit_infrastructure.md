# Security & Audit Infrastructure

## Overview
This document covers the security hardening, audit automation, and operational monitoring features implemented across the Dajingo platform kernel.

---

## 1. Rate Limiting (Authentication Endpoints)

### Goal
Prevent brute-force login attacks, registration spam, and tenant enumeration.

### Files
- **`erp/throttles.py`** — Custom DRF throttle classes
- **`erp/views_auth.py`** — Throttles applied to auth views
- **`erp/views.py`** — Throttle applied to tenant resolution
- **`core/settings.py`** — Rate limits configured in `REST_FRAMEWORK`

### Configuration (settings.py)
```python
'DEFAULT_THROTTLE_RATES': {
    'login': '5/minute',
    'register': '3/minute',
    'tenant_resolve': '30/minute',
}
```

### Endpoints Protected
| Endpoint | Throttle | Rate |
|---|---|---|
| `POST /api/auth/login/` | `LoginRateThrottle` | 5/min per IP |
| `POST /api/auth/register/business/` | `RegisterRateThrottle` | 3/min per IP |
| `GET /api/tenant/resolve/` | `TenantResolveRateThrottle` | 30/min per IP |

### Step-by-Step Workflow
1. Request arrives at throttled endpoint
2. DRF checks cache for IP's recent request count
3. If rate exceeded → returns `429 Too Many Requests`
4. If under limit → request proceeds normally

---

## 2. AuditLog Integration (TenantModelViewSet)

### Goal
Automatically log all CREATE/UPDATE/DELETE operations on tenant-scoped data to the `auditlog` table.

### Data Flow
- **READ**: `AuditLogMixin` reads org context from `get_current_tenant_id()` (contextvars)
- **SAVE**: Creates entries in `auditlog` table via `AuditLog.objects.create()`

### How It Works
1. `TenantModelViewSet` inherits from `AuditLogMixin` + `viewsets.ModelViewSet`
2. `perform_create()` → serializer.save() → `_log_action('CREATE', instance)`
3. `perform_update()` → captures old_data → serializer.save() → `_log_action('UPDATE', ...)`
4. `perform_destroy()` → captures old_data → `_log_action('DELETE', ...)`
5. All subclasses (`ProductViewSet`, `SiteViewSet`, etc.) inherit this automatically

### Tables Affected
- **Reads**: None (fires on each mutation)
- **Writes**: `auditlog`

---

## 3. Permission Seeding

### Goal
Populate the `permission` table with 55 permission codes across 7 modules.

### Command
```bash
python manage.py seed_permissions
```

### Modules Covered
| Module | Permissions |
|---|---|
| Inventory | 14 (view/add/edit/delete products, stock ops, warehouses, categories, brands) |
| Finance | 10 (ledger, entries, reports, COA, accounts, fiscal) |
| POS | 7 (sell, void, discount, sales, registers, reports) |
| CRM | 6 (contacts CRUD, suppliers, customers) |
| Purchasing | 5 (orders CRUD, approve, receive) |
| Audit | 5 (logs, workflows, approvals, tasks) |
| Admin | 8 (users, roles, settings, sites) |

### Tables Affected
- **Writes**: `permission`
- **Read by**: `role_permissions` M2M, `use-permissions.tsx` (frontend hook)

---

## 4. Workflow Service Integration

### Goal
Enable configurable approval workflows for sensitive operations (price changes, stock adjustments, etc.).

### Command
```bash
python manage.py seed_workflows
```

### Active Workflows (default)
| Workflow | Event Type | Mode |
|---|---|---|
| Price Change Approval | `product.price_change` | PRE (blocks until approved) |
| Discount Application Audit | `pos.discount_applied` | POST (audit only) |

### Tables Affected
- **Writes**: `workflowdefinition`
- **Read by**: `PriceChangeWorkflowMixin` in `erp/mixins.py`

---

## 5. Contextvars Migration (Async-Safe Middleware)

### Goal
Replace `threading.local()` with `contextvars.ContextVar` for async-safe tenant context.

### File
- **`erp/middleware.py`**

### Why
- `threading.local()` leaks state in async/ASGI contexts
- `contextvars` works correctly in both sync and async Django
- Required for future ASGI deployment

### Variables
- `_tenant_id: ContextVar[str | None]` — stores current request's tenant ID

---

## 6. IP Whitelisting (SaaS Admin Panel)

### Goal
Restrict `/api/saas/` endpoints to trusted IPs only.

### File
- **`erp/ip_whitelist.py`**
- **`core/settings.py`** — `SAAS_ADMIN_IP_WHITELIST = []`

### Configuration
```python
# Open mode (allow all) — DEFAULT
SAAS_ADMIN_IP_WHITELIST = []

# Restricted mode (only these IPs can access /api/saas/)
SAAS_ADMIN_IP_WHITELIST = ['127.0.0.1', '91.99.186.183']
```

### Workflow
1. Request arrives for `/api/saas/*` path
2. If whitelist is empty → allow all (open mode)
3. If whitelist has IPs → check client IP against list
4. If IP not in whitelist → return `403 Access denied`
5. Logs blocked attempts to `erp` logger

---

## 7. Audit Models (models_audit.py)

### Goal
Provide Python model layer for existing audit/workflow DB tables.

### Models
| Model | DB Table | Purpose |
|---|---|---|
| `AuditLog` | `auditlog` | Records all data mutations with before/after JSON |
| `WorkflowDefinition` | `workflowdefinition` | Configurable approval rules per event type |
| `ApprovalRequest` | `approvalrequest` | Tracks pending/resolved approval requests |
| `TaskTemplate` | `tasktemplate` | Reusable task definitions |
| `TaskQueue` | `taskqueue` | Individual task instances |
| `ForensicAuditLog` | `forensicauditlog` | Immutable forensic audit trail |

All models use `managed = False` — tables were created by migration 0025.

---

## 8. Record History API

### Goal
Retrieve the full audit trail for any entity.

### Endpoint
```
GET /api/record-history/trail/?table=Product&id=<uuid>&limit=50
```

### Response
```json
{
  "table": "Product",
  "record_id": "uuid",
  "history": [
    {
      "id": "uuid",
      "timestamp": "ISO8601",
      "action": "UPDATE",
      "actor": "username",
      "old_value": {...},
      "new_value": {...},
      "ip_address": "1.2.3.4"
    }
  ]
}
```

### Data Flow
- **Reads**: `auditlog` table filtered by `table_name` + `record_id`
- **Scoped**: By tenant (organization_id) from middleware context

---

## 9. Entity Graph API

### Goal
Visualize relationships between an entity and its audit/approval/task references.

### Endpoint
```
GET /api/entity-graph/relations/?table=Product&id=<uuid>
```

### Response
```json
{
  "entity": {"table": "Product", "id": "uuid"},
  "audit_count": 12,
  "approvals": [...],
  "tasks": [...]
}
```

### Data Flow
- **Reads**: `auditlog`, `approvalrequest`, `taskqueue`
- **Scoped**: By tenant from middleware context
