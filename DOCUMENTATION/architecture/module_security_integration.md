# Module Security and Connector Integration

> Version: v1.2.3
> Last Updated: 2026-02-04

This document describes the security, audit logging, and Connector integration patterns implemented across all core modules.

---

## Overview

All core modules now implement:

1. **Audit Logging** via `AuditLogMixin` or `TenantModelViewSet` base class
2. **Connector Routing** via `ConnectorAwareMixin` for graceful degradation
3. **Granular Permissions** via module-specific permission classes

---

## Architecture

### Mixins (`erp/mixins.py`)

| Mixin | Purpose |
|-------|---------|
| `AuditLogMixin` | Automatically logs CREATE/UPDATE/DELETE operations to `AuditLog` |
| `ConnectorAwareMixin` | Buffers requests if module is disabled for tenant |
| `TenantFilterMixin` | Filters querysets by organization automatically |

### Permission Classes (`erp/permissions.py`)

| Module | View Permission | Manage Permission | Special Permissions |
|--------|----------------|-------------------|---------------------|
| **Finance** | `CanViewFinance` | `CanManageFinance` | `CanPostJournalEntries`, `CanCloseAccounting` |
| **Inventory** | `CanViewInventory` | `CanManageInventory` | `CanAdjustStock`, `CanTransferStock` |
| **POS** | `CanAccessPOS` | `CanProcessSales` | `CanVoidSale`, `CanApplyDiscount`, `CanRefund` |
| **HR** | `CanViewHR` | `CanManageHR` | `CanViewSalary`, `CanManagePayroll` |
| **CRM** | `CanViewCRM` | `CanManageCRM` | `CanManageLeads` |
| **Purchasing** | `CanViewPurchasing` | `CanCreatePO` | `CanApprovePO`, `CanReceiveGoods` |

---

## Module Integration Status

### Finance Module (`views_finance.py`)

| ViewSet | Connector | Permissions | Audit |
|---------|-----------|-------------|-------|
| `ChartOfAccountViewSet` | ✅ `finance` | ✅ `FinanceReadOnlyOrManage` | ✅ |
| `FinancialAccountViewSet` | ✅ `finance` | ✅ | ✅ |
| `FiscalYearViewSet` | ✅ `finance` | ✅ | ✅ |
| `FiscalPeriodViewSet` | ✅ `finance` | ✅ | ✅ |
| `JournalEntryViewSet` | ✅ `finance` | ✅ `CanPostJournalEntries` | ✅ |
| `LoanViewSet` | ✅ `finance` | ✅ | ✅ |
| `FinancialEventViewSet` | ✅ `finance` | ✅ | ✅ |

### Inventory Module (`views.py`)

| ViewSet | Connector | Permissions | Audit |
|---------|-----------|-------------|-------|
| `ProductViewSet` | ✅ `inventory` | ✅ `required_permissions` | ✅ via `TenantModelViewSet` |
| `WarehouseViewSet` | ✅ `inventory` | ✅ | ✅ |
| `InventoryViewSet` | ✅ `inventory` | ✅ | ✅ |
| `BrandViewSet` | ✅ `inventory` | ✅ | ✅ |
| `CategoryViewSet` | ✅ `inventory` | ✅ | ✅ |
| `ParfumViewSet` | ✅ `inventory` | ✅ | ✅ |
| `ProductGroupViewSet` | ✅ `inventory` | ✅ | ✅ |

### POS Module

| ViewSet | Connector | Permissions | Audit |
|---------|-----------|-------------|-------|
| `POSViewSet` | ✅ `pos` | ✅ `CanAccessPOS` | ✅ via service |

### Purchasing Module

| ViewSet | Connector | Permissions | Audit |
|---------|-----------|-------------|-------|
| `PurchaseViewSet` | ✅ `purchasing` | ✅ `CanViewPurchasing` | ✅ via service |

### HR Module

| ViewSet | Connector | Permissions | Audit |
|---------|-----------|-------------|-------|
| `EmployeeViewSet` | ✅ `hr` | ✅ `HRReadOnlyOrManage` | ✅ |
| `RoleViewSet` | ✅ `hr` | ✅ `HRReadOnlyOrManage` | ✅ |

### CRM Module

| ViewSet | Connector | Permissions | Audit |
|---------|-----------|-------------|-------|
| `ContactViewSet` | ✅ `crm` | ✅ `CRMReadOnlyOrManage` | ✅ |

---

## Usage Examples

### Adding Connector Support to a New ViewSet

```python
from .mixins import AuditLogMixin, ConnectorAwareMixin

class MyViewSet(AuditLogMixin, ConnectorAwareMixin, TenantModelViewSet):
    queryset = MyModel.objects.all()
    serializer_class = MySerializer
    
    # Connector configuration
    connector_module = 'mymodule'  # Must match SystemModule.name
    
    # Audit configuration
    audit_model_name = 'MyModel'
    
    # Permission configuration
    permission_classes = [IsAuthenticated, MyModulePermission]
```

### Creating a New Permission Class

```python
from .permissions import BaseModulePermission

class CanViewMyModule(BaseModulePermission):
    permission_code = 'mymodule.view'
    message = 'You do not have permission to view this data.'
```

---

## Connector Behavior

When a module is **disabled** for a tenant:

1. **List/Retrieve** operations return empty data (bypass)
2. **Create/Update/Delete** operations are **buffered**
3. Buffered requests are stored in `BufferedRequest` table
4. When module is enabled, buffered requests can be replayed

---

## Audit Log Schema

Each CRUD operation logs:

| Field | Description |
|-------|-------------|
| `organization_id` | Tenant context |
| `user` | Actor who performed action |
| `action` | CREATE, UPDATE, DELETE, POST, CLOSE, etc. |
| `entity_type` | Model name (e.g., 'Product', 'ChartOfAccount') |
| `entity_id` | Primary key of affected record |
| `old_data` | State before change (for UPDATE/DELETE) |
| `new_data` | State after change (for CREATE/UPDATE) |
| `ip_address` | Client IP |
| `user_agent` | Browser/client identifier |
