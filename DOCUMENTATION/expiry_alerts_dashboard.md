# Expiry Alerts Dashboard

## Goal
Monitor and manage product batches nearing or past expiration, categorized by severity (Expired, Critical, Warning).

## Page: `/inventory/expiry-alerts`

### Data READ
- `GET /inventory/expiry-alerts/` — list alerts + stats, filterable by severity/acknowledged
- Scan returns count of new alerts created

### Data SAVED
- `POST /inventory/scan-expiry/` — trigger batch scan for expiring products
- `POST /inventory/acknowledge-alert/` — mark alert as handled

### Variables
- **activeFilter**: `null` (all) | `EXPIRED` | `CRITICAL` | `WARNING`
- **showAcknowledged**: boolean toggle
- **scanning**: loading state for scan button

### Workflow
1. Page loads and fetches all unacknowledged alerts
2. Shows 5 KPI cards: Total Active, Expired, Critical, Warning, Value at Risk
3. Click severity card to filter table
4. Click "Scan Now" to run `ValuationService.check_expiry_alerts()` — creates new alerts
5. Click "Ack" on individual alerts to mark as acknowledged

### How It Works
- Backend scans `ProductBatch` records with `expiry_date` and `status=ACTIVE`
- Categorizes: EXPIRED (past date), CRITICAL (0-30 days), WARNING (30-60 days)
- Calculates `value_at_risk = quantity × cost_price`
- Expired batches get their status changed to `EXPIRED` automatically

## Files
- `erp_backend/apps/inventory/valuation_service.py` — `check_expiry_alerts()`
- `erp_backend/apps/inventory/advanced_models.py` — `ExpiryAlert`, `ProductBatch`
- `erp_backend/apps/inventory/views.py` — 3 endpoints
- `src/app/actions/inventory/expiry-alerts.ts` — Server actions
- `src/app/(privileged)/inventory/expiry-alerts/page.tsx` — Page component
