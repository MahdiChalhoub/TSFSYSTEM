# Connector Policies Configuration

## Goal
Configure fallback behaviors for inter-module communication when target modules are unavailable.

## Location
`/saas/connector/policies`

## Data Flow

### READ
- **Policies**: `GET /api/v1/connector/policies/`
- **Available Modules**: `GET /api/v1/modules/`

### SAVE
- **Create**: `POST /api/v1/connector/policies/`
- **Update**: `PATCH /api/v1/connector/policies/{id}/`
- **Delete**: `DELETE /api/v1/connector/policies/{id}/`

## Variables User Interacts With

| Field | Type | Description |
|-------|------|-------------|
| `source_module` | Select | Which module is making the request (e.g., `pos`, `*` for all) |
| `target_module` | Select | Which module is being called (e.g., `inventory`) |
| `target_endpoint` | Text | Endpoint pattern (`*` for all, or specific like `products/`) |
| `when_missing_read` | Select | Action when module not installed (READ) |
| `when_missing_write` | Select | Action when module not installed (WRITE) |
| `when_disabled_read` | Select | Action when module disabled for tenant (READ) |
| `when_disabled_write` | Select | Action when module disabled for tenant (WRITE) |
| `when_unauthorized_read` | Select | Action when no permission (READ) |
| `when_unauthorized_write` | Select | Action when no permission (WRITE) |
| `cache_ttl_seconds` | Number | Cache duration for cached responses |
| `buffer_ttl_seconds` | Number | How long to keep buffered writes |
| `max_buffer_size` | Number | Maximum buffered requests per org/module |
| `priority` | Number | Higher priority policies take precedence |

## Action Options

### READ Actions
- `forward` - Forward (default)
- `wait` - Wait for availability
- `empty` - Return empty
- `cached` - Return cached
- `mock` - Return mock data
- `error` - Throw error

### WRITE Actions
- `forward` - Forward (default)
- `buffer` - Buffer for replay
- `redirect` - Redirect to fallback
- `drop` - Drop silently
- `queue` - Queue as event
- `error` - Throw error

## Step-by-Step Workflow

1. **Page loads**: Fetches policies list and available modules
2. **View policies**: Table shows existing policies with route, state actions, priority
3. **Create new**: Click "New Policy" → modal opens
4. **Select modules**: Choose source and target from dropdowns
5. **Configure actions**: Set actions for MISSING, DISABLED, UNAUTHORIZED states
6. **Save**: Creates policy in database
7. **Auto-generate**: Click "Auto-Generate" to create default policies for all modules

## Auto-Generate Feature
- Creates default policies for all modules that don't have one
- Defaults:
  - MISSING: READ=empty, WRITE=buffer
  - DISABLED: READ=empty, WRITE=drop
  - UNAUTHORIZED: READ=empty, WRITE=drop
- Skips modules that already have policies

## Files

### Frontend
- **Page**: `src/app/(privileged)/saas/connector/policies/page.tsx`
- **Actions**: `src/app/actions/saas/connector.ts`

### Backend
- **Model**: `erp_backend/erp/connector_models.py` (ConnectorPolicy)
- **Views**: `erp_backend/erp/views_connector.py` (ConnectorPolicyViewSet)
