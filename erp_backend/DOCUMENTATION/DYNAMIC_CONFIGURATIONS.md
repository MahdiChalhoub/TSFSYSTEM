# Dynamic Configurations Framework

## Goal
To replace hardcoded values (statuses, priorities, labels, currency) with user-configurable settings managed per organization. This ensures the ERP system can adapt to different business workflows without code changes.

## Backend Architecture
The framework uses `TenantModel`-based configuration models that store settings as `JSONField` or specific typed fields.

### Workspace Configuration
- **File Path**: `apps/workspace/models.py`
- **Model**: `WorkspaceConfig`
- **Data Source**: READ from `workspace_config` (Tenant scoped).
- **Data Destination**: SAVED to `workspace_config`.
- **Variables**:
  - `task_statuses`: JSON mapping of Status Code → { label, color, icon }.
  - `task_priorities`: JSON mapping of Priority Code → { label, color, multiplier }.
  - `checklist_triggers`: JSON mapping of Trigger Code → Label.
  - `request_types`: JSON mapping of Request Code → Label.
  - `task_completion_weight`, `on_time_weight`, etc.: Decimal weights for performance scoring.
  - `bronze/silver/gold/platinum_threshold`: Decimal thresholds for employee tiers.

### Supplier Portal Configuration
- **File Path**: `apps/supplier_portal/models.py`
- **Model**: `SupplierPortalConfig`
- **Data Source**: READ from `supplier_portal_config` (Tenant scoped).
- **Data Destination**: SAVED to `supplier_portal_config`.
- **Variables**:
  - `proforma_status_config`: JSON mapping of Status Code → { label, color }.
  - `proforma_auto_approve_threshold`: Decimal amount for automatic approval.
  - `default_currency`: 3-character currency code (e.g., USD, EUR).
  - `require_negotiation_notes`: Boolean toggle.

## API Workflow
1. **Fetch Config**: `GET /api/workspace/config/current/` or `GET /api/supplier-portal/config/current/`.
2. **Update Config**: `PATCH /api/workspace/config/{id}/` (Admin only).
3. **Application**: Models like `Task`, `EmployeeScore`, and `SupplierProforma` dynamically reference these settings during creation or calculation (e.g., `calculate_tier`, `recalculate_totals`).

## Business Logic Impact
- **Auto-Approval**: Supplier proformas submitted via `SUBMITTED` transition are automatically moved to `APPROVED` if their total is below the configured threshold.
- **Dynamic Labeling**: Frontend components should fetch the labels and colors from the config endpoints instead of using hardcoded maps.
