# 🎨 TSFSYSTEM Architecture Visual Diagrams

**Date:** 2026-03-12
**Purpose:** Visual reference for module connectivity and data flow

---

## 🏗️ System Architecture Overview

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                         TSFSYSTEM ERP PLATFORM                             ║
║                      Multi-Tenant SaaS Architecture                        ║
╚═══════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 16)                               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │  Finance   │ │    POS     │ │ Inventory  │ │    CRM     │              │
│  │  Module    │ │  Register  │ │ Management │ │  Portal    │              │
│  │  Pages     │ │  Interface │ │  Dashboard │ │  Dashboard │              │
│  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └──────┬─────┘              │
│         │              │              │              │                      │
│         └──────────────┴──────────────┴──────────────┘                      │
│                              │                                              │
│                              ↓                                              │
│                    ┌─────────────────┐                                      │
│                    │  API Routes     │                                      │
│                    │  /api/*         │                                      │
│                    └────────┬────────┘                                      │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │
                              ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Django 5.1)                                 │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    MIDDLEWARE LAYER                                 │    │
│  │  • TenantMiddleware      (set request.tenant)                       │    │
│  │  • AuthenticationMiddleware (JWT validation)                        │    │
│  │  • CorsMiddleware        (CORS policy)                              │    │
│  │  • ObservabilityMiddleware (request tracking)                       │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                              ↓                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    URL ROUTING                                      │    │
│  │  /api/finance/*    → apps.finance.urls                              │    │
│  │  /api/inventory/*  → apps.inventory.urls                            │    │
│  │  /api/pos/*        → apps.pos.urls                                  │    │
│  │  /api/crm/*        → apps.crm.urls                                  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┤
│  │              ⚡ CONNECTOR GOVERNANCE LAYER ⚡                        │    │
│  │────────────────────────────────────────────────────────────────────│    │
│  │                                                                     │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │ ConnectorFacade (connector)                                  │   │    │
│  │  │                                                              │   │    │
│  │  │  • connector.require(capability, org_id, **kwargs)          │   │    │
│  │  │      → READ operations (returns data or fallback)           │   │    │
│  │  │                                                              │   │    │
│  │  │  • connector.execute(capability, org_id, **kwargs)          │   │    │
│  │  │      → WRITE operations (buffers if unavailable)            │   │    │
│  │  │                                                              │   │    │
│  │  │  • connector.available(capability, org_id)                  │   │    │
│  │  │      → Check if capability exists                           │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                              ↓                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │ CapabilityRegistry                                           │   │    │
│  │  │                                                              │   │    │
│  │  │  • Auto-discovery of connector_service.py files             │   │    │
│  │  │  • 96 capabilities across 9 modules                         │   │    │
│  │  │  • Lazy loading (only load when first requested)            │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                              ↓                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │ ConnectorEngine                                              │   │    │
│  │  │                                                              │   │    │
│  │  │  • Module state machine (AVAILABLE/DEGRADED/DISABLED)       │   │    │
│  │  │  • Circuit breaker (3 failures → DEGRADED)                  │   │    │
│  │  │  • Response caching (TTL: 60-300s)                          │   │    │
│  │  │  • Request buffering & replay                               │   │    │
│  │  │  • Connector logging (audit trail)                          │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────────┤
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┤
│  │                   📦 BUSINESS MODULES                               │    │
│  │────────────────────────────────────────────────────────────────────│    │
│  │                                                                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │    │
│  │  │ Finance  │  │   POS    │  │Inventory │  │   CRM    │          │    │
│  │  │          │  │          │  │          │  │          │          │    │
│  │  │ 26 caps  │  │ 12 caps  │  │ 20 caps  │  │ 10 caps  │          │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │    │
│  │       │             │             │             │                 │    │
│  │       ↓             ↓             ↓             ↓                 │    │
│  │  connector_service.py files (declare capabilities)               │    │
│  │                                                                     │    │
│  │  Each module exposes capabilities like:                            │    │
│  │  • finance.journal.post_entry (CRITICAL)                           │    │
│  │  • inventory.stock.reserve (CRITICAL)                              │    │
│  │  • crm.contacts.get_detail (cacheable)                             │    │
│  │  • pos.orders.create                                               │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────────┤
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┤
│  │                    🔔 EVENT BUS                                     │    │
│  │────────────────────────────────────────────────────────────────────│    │
│  │                                                                     │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │ kernel.events.event_bus                                      │   │    │
│  │  │                                                              │   │    │
│  │  │  Producer Side:                                              │   │    │
│  │  │    emit_event('order.completed', {                          │   │    │
│  │  │      'order_id': 123,                                        │   │    │
│  │  │      'customer_id': 456,                                     │   │    │
│  │  │      'total_amount': 150.00                                  │   │    │
│  │  │    })                                                        │   │    │
│  │  │                                                              │   │    │
│  │  │  Consumer Side:                                              │   │    │
│  │  │    @subscribe_to_event('order.completed')                   │   │    │
│  │  │    @enforce_contract('order.completed')                     │   │    │
│  │  │    def on_order_completed(event):                           │   │    │
│  │  │        # Handle event                                        │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────────┤
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┤
│  │                    🧠 KERNEL OS                                     │    │
│  │────────────────────────────────────────────────────────────────────│    │
│  │                                                                     │    │
│  │  kernel/tenancy/     • TenantOwnedModel (auto tenant filtering)    │    │
│  │                      • TenantManager (queryset isolation)           │    │
│  │                      • TenantMiddleware (set request.tenant)        │    │
│  │                                                                     │    │
│  │  kernel/rbac/        • Role, Permission models                      │    │
│  │                      • @require_permission decorator                │    │
│  │                      • PolicyEngine (complex rules)                 │    │
│  │                                                                     │    │
│  │  kernel/config/      • get_config(key, default)                     │    │
│  │                      • ConfigurationService                         │    │
│  │                      • Per-tenant config storage                    │    │
│  │                                                                     │    │
│  │  kernel/audit/       • AuditLogMixin (auto audit trail)             │    │
│  │                      • AuditLogger (compliance logs)                │    │
│  │                      • Audit query API                              │    │
│  │                                                                     │    │
│  │  kernel/events/      • EventBus (pub/sub)                           │    │
│  │                      • Event contracts & validation                 │    │
│  │                      • Event outbox (transactional)                 │    │
│  │                                                                     │    │
│  │  kernel/lifecycle/   • TransactionStateMachine                      │    │
│  │                      • Lifecycle hooks                              │    │
│  │                                                                     │    │
│  │  kernel/modules/     • ModuleLoader (dynamic loading)               │    │
│  │                      • Module manifest (module.json)                │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────────┤
│                              ↓                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┤
│  │                    💾 DATA LAYER                                    │    │
│  │────────────────────────────────────────────────────────────────────│    │
│  │                                                                     │    │
│  │  PostgreSQL         • Tenant-partitioned data                       │    │
│  │                     • Full-text search (pg_trgm)                    │    │
│  │                     • JSON fields for flexible data                 │    │
│  │                                                                     │    │
│  │  Redis              • Session storage                               │    │
│  │                     • Cache (connector responses)                   │    │
│  │                     • Celery broker                                 │    │
│  │                                                                     │    │
│  │  Celery             • Async task processing                         │    │
│  │                     • Scheduled jobs (beat)                         │    │
│  │                     • Event replay worker                           │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Module Communication Pattern

### Example: POS creates order → Finance creates invoice → Inventory reserves stock

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  CROSS-MODULE COMMUNICATION FLOW                          │
└──────────────────────────────────────────────────────────────────────────┘

 USER INTERACTION                  CONNECTOR LAYER              TARGET MODULE
 ───────────────                   ───────────────              ─────────────

     [1] Cashier
         completes
         POS sale
            │
            ↓
     ┌──────────────┐
     │ POS Module   │
     │ View Layer   │
     └──────┬───────┘
            │
            ↓
     ┌──────────────┐
     │ POS Service  │
     │ create_order │
     └──────┬───────┘
            │
            │ [2] Need to post
            │     to journal
            │
            ├────────────────────────────────┐
            │                                │
            ↓                                ↓
    emit_event(...)              connector.execute(
    'order.completed'             'finance.journal.post_entry',
                                   org_id=X,
                                   data={...})
            │                                │
            │                                ↓
            │                    ┌───────────────────────┐
            │                    │ ConnectorFacade       │
            │                    │                       │
            │                    │ 1. Check capability   │
            │                    │    registered?        │
            │                    │                       │
            │                    │ 2. Check module state │
            │                    │    AVAILABLE?         │
            │                    │                       │
            │                    │ 3. Execute handler    │
            │                    └───────┬───────────────┘
            │                            │
            │                            ↓
            │                ┌───────────────────────────┐
            │                │ finance.connector_service │
            │                │                           │
            │                │ @_cap(registry,           │
            │                │   'finance.journal.       │
            │                │    post_entry')           │
            │                │ def post_journal_entry(): │
            │                │   LedgerService.create... │
            │                └───────┬───────────────────┘
            │                        │
            │                        ↓
            │                  ┌──────────────┐
            │                  │   Finance    │
            │                  │   Module     │
            │                  │              │
            │                  │ • Create JE  │
            │                  │ • Debit/Cred │
            │                  │ • Post       │
            │                  └──────────────┘
            │
            ↓
    ┌───────────────────┐
    │   Event Bus       │
    │                   │
    │ Dispatch to       │
    │ subscribers       │
    └─────┬─────────────┘
          │
          ├──────────────────────────┬────────────────────────┐
          ↓                          ↓                        ↓
    ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
    │  Finance     │       │  Inventory   │       │  Workspace   │
    │  Listener    │       │  Listener    │       │  Listener    │
    │              │       │              │       │              │
    │ Create       │       │ Reserve      │       │ Create task  │
    │ invoice      │       │ stock        │       │ for review   │
    └──────────────┘       └──────────────┘       └──────────────┘

 [3] All modules react independently via events
 [4] No module knows about others directly
 [5] Connector ensures resilience (cache, buffer, circuit breaker)
```

---

## 🔐 Tenant Isolation Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       TENANT ISOLATION LAYERS                             │
└──────────────────────────────────────────────────────────────────────────┘

 HTTP REQUEST                     MIDDLEWARE                    DATABASE
 ────────────                     ──────────                    ────────

 GET /api/invoices/               ┌─────────────────────┐
 Authorization:                   │ TenantMiddleware    │
   Bearer eyJ...                  │                     │
                                  │ 1. Extract JWT      │
        │                         │ 2. Resolve tenant   │
        ↓                         │ 3. Set              │
                                  │    request.tenant   │
 ┌─────────────────┐              └──────────┬──────────┘
 │ JWT Token       │                         │
 │ {               │                         │
 │   "user_id": 5, │                         ↓
 │   "org_id": 12  │              ┌─────────────────────┐
 │ }               │              │ TenantContext       │
 └─────────────────┘              │                     │
                                  │ • thread_local      │
                                  │ • request.tenant    │
                                  │ • Auto-cleared      │
                                  │   after request     │
                                  └──────────┬──────────┘
                                             │
                                             ↓
                          ┌──────────────────────────────────┐
                          │ View Layer                       │
                          │                                  │
                          │ def list_invoices(request):      │
                          │   # No explicit tenant filter!   │
                          │   invoices = Invoice.objects.all()
                          └──────────────┬───────────────────┘
                                         │
                                         ↓
                          ┌──────────────────────────────────┐
                          │ TenantManager (QuerySet)         │
                          │                                  │
                          │ def get_queryset():              │
                          │   qs = super().get_queryset()    │
                          │   tenant = get_current_tenant()  │
                          │   if tenant:                     │
                          │     qs = qs.filter(              │
                          │       tenant_id=tenant.id        │
                          │     )                            │
                          │   return qs                      │
                          └──────────────┬───────────────────┘
                                         │
                                         ↓
                          ┌──────────────────────────────────┐
                          │ SQL Query                        │
                          │                                  │
                          │ SELECT * FROM invoices           │
                          │ WHERE tenant_id = 12  ← Auto!    │
                          │ ORDER BY created_at DESC         │
                          └──────────────┬───────────────────┘
                                         │
                                         ↓
                          ┌──────────────────────────────────┐
                          │ PostgreSQL                       │
                          │                                  │
                          │ invoices table:                  │
                          │ ┌────┬──────────┬─────────────┐  │
                          │ │ id │tenant_id │ invoice_no  │  │
                          │ ├────┼──────────┼─────────────┤  │
                          │ │ 1  │    12    │ INV-001     │ ✅
                          │ │ 2  │    12    │ INV-002     │ ✅
                          │ │ 3  │    99    │ INV-001     │ ❌ filtered
                          │ │ 4  │    12    │ INV-003     │ ✅
                          │ └────┴──────────┴─────────────┘  │
                          └──────────────────────────────────┘

 RESULT: User only sees invoices for their tenant (org_id=12)
 SECURITY: Impossible to access other tenant data without bypassing manager
```

---

## 🔥 Circuit Breaker State Machine

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  CONNECTOR CIRCUIT BREAKER                                │
└──────────────────────────────────────────────────────────────────────────┘

                            ╔═══════════════╗
                            ║   AVAILABLE   ║
                            ║               ║
                            ║ • Execute all ║
                            ║   requests    ║
                            ║ • Cache hits  ║
                            ╚═══════╦═══════╝
                                    │
                                    │ Normal operation
                                    │ Success rate > 95%
                                    │
                  ╔═════════════════╩═════════════════╗
                  ↓                                   ↓
          ┌───────────────┐                   ┌───────────────┐
          │ 3 failures in │                   │ Admin action: │
          │  60 seconds   │                   │ DISABLE module│
          └───────┬───────┘                   └───────┬───────┘
                  │                                   │
                  ↓                                   ↓
            ╔═════════════╗                     ╔═════════════╗
            ║  DEGRADED   ║                     ║  DISABLED   ║
            ║             ║                     ║             ║
            ║ • READs     ║                     ║ • READs     ║
            ║   → cache   ║                     ║   → cache   ║
            ║ • WRITEs    ║                     ║ • WRITEs    ║
            ║   → buffer  ║                     ║   → buffer  ║
            ╚═════╦═══════╝                     ╚═════╦═══════╝
                  │                                   │
                  │                                   │
     ┌────────────┴────────────┐         ┌────────────┴────────────┐
     │ Auto-recovery:          │         │ Manual action:          │
     │ • Success request       │         │ • Admin RE-ENABLEs      │
     │ • Timeout (5 min)       │         │ • Module fixed          │
     │ • Admin reset           │         │                         │
     └────────────┬────────────┘         └────────────┬────────────┘
                  │                                   │
                  └──────────────┬────────────────────┘
                                 │
                                 ↓
                          ╔═════════════╗
                          ║  AVAILABLE  ║
                          ╚═════════════╝
                                 │
                                 │
           ┌─────────────────────┴─────────────────────┐
           │ Replay buffered requests                  │
           │ • FIFO order                              │
           │ • Respect TTL                             │
           │ • Log results                             │
           └───────────────────────────────────────────┘

Example:
  Finance module database down
  → 3 consecutive post_entry() failures
  → Circuit TRIPS to DEGRADED
  → All writes buffered
  → All reads served from cache
  → Database restored
  → Admin resets circuit or auto-timeout
  → State → AVAILABLE
  → Buffered writes replayed
```

---

## 📦 Capability Resolution Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│               CONNECTOR CAPABILITY RESOLUTION                             │
└──────────────────────────────────────────────────────────────────────────┘

 CALLER                       CONNECTOR REGISTRY             TARGET MODULE
 ──────                       ──────────────────             ─────────────

 connector.require(
   'crm.contacts.
    get_detail',
   org_id=5,
   contact_id=123
 )
     │
     ↓
 ┌─────────────────────┐
 │ ConnectorFacade     │
 │ .require()          │
 └──────┬──────────────┘
        │
        ↓
 ┌─────────────────────┐
 │ CapabilityRegistry  │
 │ .get('crm.contacts. │
 │      get_detail')   │
 └──────┬──────────────┘
        │
        ├──── Capability in cache?
        │
        ├─ YES ────────────────────┐
        │                          │
        └─ NO                      │
           │                       │
           ↓                       │
     ┌─────────────────┐           │
     │ Auto-discover   │           │
     │ module 'crm'    │           │
     └────┬────────────┘           │
          │                        │
          ↓                        │
     ┌─────────────────────────────────┐
     │ import                          │
     │ apps.crm.connector_service      │
     │                                 │
     │ connector_service.              │
     │   register_capabilities(        │
     │     registry                    │
     │   )                             │
     └────┬────────────────────────────┘
          │
          ↓
     ┌─────────────────────────────────┐
     │ CRM connector_service.py        │
     │                                 │
     │ @_cap(registry,                 │
     │   'crm.contacts.get_detail',    │
     │   cacheable=True,               │
     │   cache_ttl=300)                │
     │ def get_contact_detail(         │
     │   org_id, contact_id            │
     │ ):                              │
     │   from apps.crm.models          │
     │     import Contact              │
     │   return Contact.objects.get(   │
     │     id=contact_id,              │
     │     organization_id=org_id      │
     │   )                             │
     └────┬────────────────────────────┘
          │
          ↓
     ┌─────────────────┐
     │ Capability      │
     │ registered in   │
     │ registry cache  │
     └────┬────────────┘
          │                        │
          └────────────────────────┘
                                   │
                                   ↓
              ┌────────────────────────────────┐
              │ ConnectorEngine                │
              │                                │
              │ 1. Check module state          │
              │    (AVAILABLE?)                │
              │                                │
              │ 2. Execute capability handler  │
              │                                │
              │ 3. Cache response (TTL=300s)   │
              │                                │
              │ 4. Return to caller            │
              └────────────────────────────────┘

RESULT: Caller receives contact data
        Next call within 300s → served from cache (no DB query)
        Module becomes unavailable → cached value returned
```

---

## 🎭 Event-Driven Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       EVENT-DRIVEN ARCHITECTURE                           │
└──────────────────────────────────────────────────────────────────────────┘

 PRODUCER                    EVENT BUS                    CONSUMERS
 ────────                    ─────────                    ─────────

 POS Module
 ┌──────────────┐
 │ Order        │
 │ completed    │
 │ successfully │
 └──────┬───────┘
        │
        ↓
 ┌──────────────┐
 │ emit_event(  │
 │   'order.    │
 │   completed',│
 │   {          │
 │     order_id,│
 │     customer │
 │     items,   │
 │     total    │
 │   }          │
 │ )            │
 └──────┬───────┘
        │
        ↓
   ┌─────────────────────────────────────┐
   │ kernel.events.EventBus              │
   │                                     │
   │ 1. Validate against contract       │
   │    @enforce_contract()              │
   │                                     │
   │ 2. Create Event object              │
   │    - event_name                     │
   │    - payload                        │
   │    - organization_id                │
   │    - triggered_by (user)            │
   │    - timestamp                      │
   │                                     │
   │ 3. Store in EventOutbox (DB)        │
   │    (transactional safety)           │
   │                                     │
   │ 4. Dispatch to subscribers          │
   └────────┬────────────────────────────┘
            │
            ├──────────────────┬──────────────────┬──────────────────┐
            ↓                  ↓                  ↓                  ↓
   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌────────┐
   │ Finance Module  │ │Inventory Module │ │ Workspace Module│ │  ...   │
   │                 │ │                 │ │                 │ │        │
   │ @subscribe_to_  │ │ @subscribe_to_  │ │ @subscribe_to_  │ │        │
   │   event(        │ │   event(        │ │   event(        │ │        │
   │  'order.        │ │  'order.        │ │  'order.        │ │        │
   │   completed'    │ │   completed'    │ │   completed'    │ │        │
   │ )               │ │ )               │ │ )               │ │        │
   │                 │ │                 │ │                 │ │        │
   │ def on_order_   │ │ def on_order_   │ │ def on_order_   │ │        │
   │  completed():   │ │  completed():   │ │  completed():   │ │        │
   │                 │ │                 │ │                 │ │        │
   │ • Create invoice│ │ • Reserve stock │ │ • Create task   │ │        │
   │ • Post to ledger│ │ • Update levels │ │ • Notify team   │ │        │
   │ • Send receipt  │ │ • Alert if low  │ │                 │ │        │
   └─────────────────┘ └─────────────────┘ └─────────────────┘ └────────┘

KEY BENEFITS:
  ✅ Producer doesn't know consumers
  ✅ Consumers can be added/removed dynamically
  ✅ Transactional safety (EventOutbox pattern)
  ✅ Contract validation prevents bad data
  ✅ Audit trail (all events logged)
```

---

## 🔐 RBAC Permission Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   ROLE-BASED ACCESS CONTROL                               │
└──────────────────────────────────────────────────────────────────────────┘

 HTTP REQUEST                RBAC LAYER                   VIEW/SERVICE
 ────────────                ──────────                   ────────────

 POST /api/invoices/
 Authorization:
   Bearer eyJ...
 {
   "customer_id": 123,
   "total": 500.00
 }
     │
     ↓
 ┌─────────────────┐
 │ AuthMiddleware  │
 │                 │
 │ • Extract JWT   │
 │ • Validate sig  │
 │ • Set           │
 │   request.user  │
 └──────┬──────────┘
        │
        ↓
 ┌─────────────────────────────┐
 │ View Decorator              │
 │                             │
 │ @require_permission(        │
 │   'finance.create_invoice'  │
 │ )                           │
 │ def create_invoice_view():  │
 └──────┬──────────────────────┘
        │
        ↓
 ┌─────────────────────────────┐
 │ kernel.rbac.permissions     │
 │                             │
 │ user.has_permission(        │
 │   'finance.create_invoice'  │
 │ )                           │
 └──────┬──────────────────────┘
        │
        ↓
 ┌─────────────────────────────────────────┐
 │ Permission Resolution                   │
 │                                         │
 │ 1. Get user roles                       │
 │    user.roles.all()                     │
 │    → ['Accountant', 'Manager']          │
 │                                         │
 │ 2. Get role permissions                 │
 │    for role in roles:                   │
 │      role.permissions.all()             │
 │    → ['finance.create_invoice',         │
 │       'finance.view_invoice',           │
 │       ...]                              │
 │                                         │
 │ 3. Check permission exists              │
 │    'finance.create_invoice' in perms?   │
 │    → YES ✅                              │
 │                                         │
 │ 4. Check policy engine (optional)       │
 │    PolicyEngine.check(                  │
 │      'invoice.can_create',              │
 │      user, context                      │
 │    )                                    │
 │    → Check business rules:              │
 │      • Credit limit not exceeded?       │
 │      • Fiscal period open?              │
 │      • User's branch authorized?        │
 │    → YES ✅                              │
 └──────┬──────────────────────────────────┘
        │
        ├─ PASS ────────────────┐
        │                       │
        └─ FAIL                 │
           │                    │
           ↓                    ↓
      ┌────────────┐    ┌──────────────┐
      │ Raise      │    │ Execute view │
      │ Permission │    │ • Create     │
      │ Denied     │    │   invoice    │
      │            │    │ • Save       │
      │ HTTP 403   │    │ • Audit log  │
      └────────────┘    └──────────────┘

RESULT: Fine-grained access control at view and field level
        Centralized permission management
        Policy engine for complex business rules
```

---

**Generated:** 2026-03-12
**Purpose:** Visual reference for architecture understanding
**Maintained By:** Architecture team
