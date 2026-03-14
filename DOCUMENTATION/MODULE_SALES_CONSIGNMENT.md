# Depot Vente (Consignment) — Documentation

## Goal
Manage stock received from suppliers without immediate payment. Track sales of these items and manage bulk settlements (payouts) back to the supplier.

## Data Sources

### READ
- `GET /api/inventory/available-consignment/` — current consignment stock
- `GET /api/consignment-settlements/pending-items/` — sold items awaiting payout
- `GET /api/consignment-settlements/` — previous payout history

### WRITE
- `POST /api/consignment-settlements/generate-settlement/` — process a payout for selected sold items

## Workflow
1. **Reception**: Stock is received and flagged as `is_consignment=True` with an associated `supplier` and `consignment_cost`.
2. **Sale**: When sold via POS, the `OrderLine` inherits the consignment status and agreed payout amount.
3. **Tracking**: The Payout Desk (`/sales/consignment`) monitors sold-but-unsettled consignment items.
4. **Settlement**: The manager selects sold items for a supplier and "Generates Settlement". This creates a `ConsignmentSettlement` record and marks lines as `consignment_settled=True`.

## Database Schema

### Table: `inventory` (updates)
- `is_consignment`: Boolean flag.
- `supplier_id`: FK to `Contact`.
- `consignment_cost`: Agreed unit payout amount.

### Table: `pos_orderline` (updates)
- `is_consignment`: Heritage from stock.
- `consignment_payout`: Amount to pay supplier for this specific line.
- `consignment_settled`: Boolean flag.

### Table: `pos_consignment_settlement`
- Header record for a payout. Includes supplier, total amount, and status.

## Files
| Layer | File |
|-------|------|
| Models | `inventory/models.py`, `pos/consignment_models.py` |
| ViewSets | `inventory/views.py`, `pos/views.py` |
| Actions | `src/app/actions/consignment.ts` |
| Dashboard | `src/app/(privileged)/sales/consignment/page.tsx` |
| UI Component | `src/app/(privileged)/sales/consignment/manager.tsx` |
