# Global Audit Trail Implementation Plan

## Goal
Resolve the user's request for a "page for all Audit Trail" by creating a centralized compliance dashboard that aggregates audit logs from the newly fixed kernel-based audit system.

## User Review Required
> [!IMPORTANT]
> The new Audit Trail page will be accessible at `/settings/audit-trail`. This page will display all system changes across all modules that use the `kernel.audit` system.

## Proposed Changes

### [Kernel Audit System]

#### [MODIFY] [views.py](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/erp_backend/kernel/audit/views.py)
- Ensure the `AuditTrailViewSet` continues to support unfiltered queries (fetching all logs for the current tenant when no `resource_type` is provided).

### [Frontend - Global Audit Page]

#### [NEW] [page.tsx](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/src/app/%28privileged%29/settings/audit-trail/page.tsx)
- Create a dedicated admin page for the Global Audit Trail.
- Features:
    - Centralized list of all audit logs using `AuditTrailPanel` logic in a full-page layout.
    - Quick filters for `resource_type`.
    - Integrated Search (by resource ID or repr).

#### [MODIFY] [menu.ts](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/admin/_lib/menu/core.ts)
- Add "Global Audit Trail" to the core sidebar menu under **Settings > Compliance**.

## Open Questions
- Should this page replace the module-specific "Product Audit Trail" or exist alongside it? (Recommendation: Keep module-specific ones for context, but provided this global one for unified oversight).

## Verification Plan

### Automated Tests
- `docker exec tsfsystem-backend-1 python manage.py shell -c "from kernel.audit.models import AuditLog; print(AuditLog.all_objects.count())"`
- Verify API response via `/api/proxy/audit-trail/`.

### Manual Verification
- Navigate to `/settings/audit-trail` and verify logs appear.
- Perform a change in Categories and verify it appears in the list.
