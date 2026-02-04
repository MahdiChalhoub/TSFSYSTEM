# Connector Module Architecture

> **Classification**: KERNEL - Core Infrastructure  
> The Connector lives alongside Kernel, Event Bus, Permission Engine, and Config Registry.

---

## 1. Overview

The **Connector Module** is the nervous system of the Dajingo platform. It acts as a **Module Contract Registry + Runtime Broker** that:

- 🧠 **Memory**: Knows what each module provides and needs
- 🚦 **Traffic Controller**: Routes all inter-module communication
- 🛡 **Stability Shield**: Ensures no crashes from missing modules

### Core Principle
> A module never decides what happens when another module is unavailable.  
> Only the Connector decides. Modules only declare intent.

---

## 2. The 4 Module States

The Connector manages 4 distinct states for every target module:

| State | Icon | Description |
|-------|------|-------------|
| AVAILABLE | 🟢 | Module installed and enabled for tenant |
| MISSING | 🟡 | Module not installed on system |
| DISABLED | 🔵 | Module installed but disabled for tenant |
| UNAUTHORIZED | 🔴 | Module exists but tenant has no permission |

These are **NOT errors** - they are states that the Connector manages through configured policies.

---

## 3. Decision Matrix

### READ Operations

| Target State | Default Action | Options |
|--------------|----------------|---------|
| 🟢 AVAILABLE | Forward request | - |
| 🟡 MISSING | Empty response | WAIT, EMPTY, CACHED, MOCK |
| 🔵 DISABLED | Empty response | EMPTY, CACHED, ERROR |
| 🔴 UNAUTHORIZED | Empty response | EMPTY, MASKED, ERROR |

### WRITE Operations

| Target State | Default Action | Options |
|--------------|----------------|---------|
| 🟢 AVAILABLE | Forward request | - |
| 🟡 MISSING | Buffer for replay | BUFFER, REDIRECT, DROP |
| 🔵 DISABLED | Drop silently | DROP, BUFFER, ERROR |
| 🔴 UNAUTHORIZED | Drop silently | DROP, LOG, ERROR |

---

## 4. Data Models

### ModuleContract
Declares what a module provides and needs:
```json
{
  "provides": {
    "read_endpoints": ["products/", "categories/"],
    "write_endpoints": ["products/create/"],
    "events_emitted": ["product.created"]
  },
  "needs": {
    "data_from": [{"module": "inventory", "endpoint": "products/cost/"}],
    "events_from": [{"module": "pos", "event": "sale.completed"}]
  },
  "rules": {
    "can_work_without": ["crm"],
    "buffer_writes_to": ["accounting"]
  }
}
```

### ConnectorPolicy
Runtime fallback behavior configuration per module/endpoint:
- `when_missing_read`: Action for reads when module missing
- `when_missing_write`: Action for writes when module missing  
- `when_disabled_read/write`: Actions when module disabled
- `when_unauthorized_read/write`: Actions when no permission
- `cache_ttl_seconds`: How long to cache responses
- `buffer_ttl_seconds`: How long to retain buffered writes

### BufferedRequest  
Queue for writes that couldn't be delivered:
- Automatically replayed when module becomes available
- Expires after configured TTL
- Supports retry logic with max attempts

---

## 5. API Endpoints

### ViewSet Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/connector/contracts/` | GET, POST | Module contracts CRUD |
| `/api/v1/connector/policies/` | GET, POST, PUT, DELETE | Policy configuration |
| `/api/v1/connector/buffer/` | GET, POST | Buffered request management |
| `/api/v1/connector/logs/` | GET | Routing decision logs |

### Path Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/connector/states/` | GET | Get all module states for org |
| `/api/v1/connector/dashboard/` | GET | Dashboard summary statistics |
| `/api/v1/connector/route/` | POST | Main routing endpoint |

### Route Request Format
```json
{
  "target_module": "inventory",
  "endpoint": "products/",
  "operation": "read",
  "params": {},
  "data": {}
}
```

---

## 6. Frontend Usage

### Simple Connector (Legacy Compatible)
```typescript
import { ModuleConnectors } from '@/lib/connectors'

// Returns data or fallback if module unavailable
const products = await ModuleConnectors.inventory.getProducts()
```

### State-Aware Connector (Advanced)
```typescript
import { StateAwareConnectors } from '@/lib/connectors'

const response = await StateAwareConnectors.inventory.getProducts()

if (response.fallback_applied) {
    console.log(`Module state: ${response.state}`)
}
```

### Write with Buffering
```typescript
import { connectorWrite } from '@/lib/connectors'

const result = await connectorWrite('inventory', 'products/', { name: 'New Product' })

if (result.buffered) {
    console.log('Request buffered - will replay when module available')
}
```

---

## 7. SuperAdmin Configuration

The Connector Configuration Panel at `/saas/connector` allows SuperAdmin to:

1. **View Module States**: See all modules and their current states
2. **Configure Policies**: Set fallback behaviors per module/endpoint
3. **Monitor Buffer**: View and manage buffered requests
4. **View Logs**: Audit routing decisions

---

## 8. Integration Points

### ModuleManager Integration
When `ModuleManager.grant_access()` is called, the Connector automatically replays any buffered requests for that module.

### Permission Engine Integration  
The Connector checks the Permission Engine to determine UNAUTHORIZED state.

---

## 9. Files Reference

| File | Purpose |
|------|---------|
| [connector_models.py](file:///c:/tsfci/erp_backend/erp/connector_models.py) | Data models |
| [connector_engine.py](file:///c:/tsfci/erp_backend/erp/connector_engine.py) | Runtime broker |
| [views_connector.py](file:///c:/tsfci/erp_backend/erp/views_connector.py) | API views |
| [connectors/index.ts](file:///c:/tsfci/src/lib/connectors/index.ts) | Frontend library |

---

## 10. Why This Matters

With the Connector Module:

✅ No direct module-to-module calls  
✅ No crash if a module is missing  
✅ No data loss (buffering)  
✅ No hard dependencies  
✅ SuperAdmin-controlled policies  
✅ Enterprise-grade isolation
