# Audit Trail

## Goal
Track all changes across the system — who changed what, when, with full historical payload data.

## Page: `/finance/audit-trail`

### Data READ
- `GET /finance/audit-logs/` — paginated list of forensic audit log entries

### Data SAVED
- No writes from this page (read-only). Logs are automatically created by the system.

### Variables
- **filterAction**: `CREATE` | `UPDATE` | `DELETE` | `POST` | `REVERSE` | all
- **filterModel**: model name filter (e.g., JournalEntry, Payment, Order)
- **search**: full-text search across model name, object ID, payload
- **page**: pagination state
- **expandedRow**: row ID for expanded JSON payload view

### Workflow
1. Page loads with most recent audit records (50 per page)
2. Each row shows: timestamp, action badge (color-coded), model, object ID, actor
3. Click any row to expand/collapse the JSON payload details
4. Filter by action type (dropdown) or model name (dropdown)
5. Paginate through records

### How It Works
- `ForensicAuditLog` model records CREATE/UPDATE/DELETE/POST/REVERSE events
- Each entry includes: actor (user), model_name, object_id, change_type, payload (JSON), timestamp
- Indexed on `(organization, model_name, object_id)` and `(organization, timestamp)`

## Files
- `erp_backend/apps/finance/models.py` — `ForensicAuditLog` model
- `erp_backend/apps/finance/views.py` — `ForensicAuditLogViewSet`
- `src/app/actions/finance/audit-trail.ts` — Server actions
- `src/app/(privileged)/finance/audit-trail/page.tsx` — Page component
