# Unimplemented Plans — Fix Report

## Date: Feb 15, 2026

## What Was Fixed

### A. `services_audit.py` Source Reconstructed (CRITICAL)
- **Problem**: Only `.pyc` bytecode existed — source file was missing
- **Fix**: Reconstructed from usage patterns in `mixins.py` (WorkflowService contract)
- **File**: `erp/services_audit.py`
- **Contains**: `WorkflowService` (PRE/POST approval gating) + `AuditService` (programmatic audit logging)
- **Data flow**:
  - READ: `workflowdefinition` table for active workflows
  - WRITE: `auditlog` and `approvalrequest` tables

### B. Encryption Fields on Organization (Already Done)
- `encryption_key` and `encryption_enabled` already existed at `models.py:232-234`
- Migration 0041 correctly synced with model

### C. RBAC Permission Checking (Frontend Wired)
- **File**: `src/kernel/permissions.ts`
- **Fix**: Replaced 3 TODO stubs with real API calls to `GET /api/users/my-permissions/`
- **How it works**:
  1. `hasPermission(code)` fetches user's role permissions from backend
  2. `canAccessModule(code)` checks if user has any `module.*` permission
  3. `getUserPermissions()` returns full list for non-superusers
- **Caching**: Permissions cached per-request via module-level variable

### D. User Permissions API Endpoint
- **Endpoint**: `GET /api/users/my-permissions/`
- **File**: `erp/views.py` (UserViewSet.my_permissions action)
- **Response**: `{ "permissions": ["inventory.view_products", ...], "role": "Admin", "is_superuser": false }`
- **Data flow**: READ from `permission` table via user's `role.permissions` M2M

### E. Encryption Management API
- **File**: `erp/views_encryption.py`
- **Endpoints**:
  | Endpoint | Method | Description |
  |---|---|---|
  | `/api/encryption/status/` | GET | Current org encryption status |
  | `/api/encryption/activate/` | POST | Activate AES-256 for org |
  | `/api/encryption/deactivate/` | POST | Deactivate (key preserved) |
  | `/api/encryption/rotate-key/` | POST | Rotate key + re-encrypt all fields |
- **Access**: Admin users only (IsAdminUser permission)
- **Data flow**: 
  - READ: `organization` table (encryption_key, encryption_enabled, current_plan)
  - WRITE: `organization` table (encryption_key, encryption_enabled)
  - READ: `planaddon` table (entitlement check)

### F. `kernel/auth.ts` Fixed
- **Problem**: `hasPermission()` always returned `true` (TODO stub)
- **Fix**: Delegates to `kernel/permissions.ts` which calls the backend API

## Remaining (Deferred)
- **G. MCP Chat save/export**: Frontend-only feature, deferred
- **H. ConnectorAwareMixin**: Infrastructure exists, apply when needed
