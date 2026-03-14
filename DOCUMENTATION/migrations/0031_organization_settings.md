# Migration 0031: Add Settings to Organization

## Goal
Add a `settings` JSONField to the `Organization` model to store organization-level configuration as JSON.

## Problem
The `Organization` model defined `settings = models.JSONField(default=dict, blank=True)` but had no corresponding migration. This caused a `ProgrammingError: column Organization.settings does not exist` on every API request that queries the Organization table, including:
- `GET /api/organizations/`
- `GET /api/dashboard/saas_stats/`

## Migration Details
- **File**: `erp/migrations/0031_organization_settings.py`
- **Depends On**: `0030_create_systemmodulelog`
- **Operation**: `AddField` — adds `settings` JSONField with `default=dict, blank=True`
- **Table Affected**: `Organization`
- **Column Added**: `settings` (JSONB in PostgreSQL)
- **Default Value**: `{}` (empty dict)

## Data Flow
- **READ**: `OrganizationSerializer` (fields='__all__'), `DashboardViewSet.saas_stats`
- **WRITE**: Any Organization create/update via API

## Verification
- `python manage.py migrate erp 0031` — Applied OK
- `Organization.objects.all()` — Returns data with `settings={}`
