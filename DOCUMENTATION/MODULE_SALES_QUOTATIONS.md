# Quotation / Proforma — Documentation

## Goal
Allow creating quotations (proforma invoices) for clients, managing line items, and converting accepted quotations into sale orders.

## Data Sources

### READ
- `GET /api/quotations/` — list all quotations with nested lines
- `GET /api/quotations/{id}/` — single quotation detail

### WRITE
- `POST /api/quotations/` — create quotation
- `PATCH /api/quotations/{id}/` — update quotation
- `DELETE /api/quotations/{id}/` — delete (DRAFT only)
- `POST /api/quotations/{id}/add-line/` — add product line
- `DELETE /api/quotations/{id}/remove-line/{lineId}/` — remove line
- `POST /api/quotations/{id}/send/` — DRAFT → SENT
- `POST /api/quotations/{id}/accept/` — → ACCEPTED
- `POST /api/quotations/{id}/reject/` — → REJECTED
- `POST /api/quotations/{id}/convert-to-order/` — → CONVERTED (creates Order)

## Lifecycle
```
DRAFT → SENT → ACCEPTED → CONVERTED (to Order)
  ↓              ↓
REJECTED      REJECTED
```

## User Workflow
1. Navigate to **Commercial → Point of Sale → Quotations**
2. Click **New** to create a quotation (reference, client, validity date, notes)
3. Add product lines with quantity and optional discount
4. When ready, click **Mark as Sent** to inform the client
5. Client accepts → click **Accept**; or **Reject** to decline
6. Click **Convert to Order** to create a sale order from the quotation
7. Converted quotation links to the created order

## Variables User Interacts With
| Variable | Type | Description |
|----------|------|-------------|
| reference | string | Quotation reference (e.g. PRO-2026-001) |
| contact | FK | Client from contacts |
| valid_until | date | Expiration date |
| notes | text | Additional notes |
| product_id | FK | Product to add as line item |
| quantity | decimal | Line quantity |
| discount | decimal | Line-level discount |

## Files
| Layer | File |
|-------|------|
| Models | `erp_backend/apps/pos/quotation_models.py` |
| Serializers | `erp_backend/apps/pos/serializers.py` (QuotationSerializer, QuotationLineSerializer) |
| Views | `erp_backend/apps/pos/views.py` (QuotationViewSet) |
| URLs | `erp_backend/apps/pos/urls.py` |
| Migration | `erp_backend/apps/pos/migrations/0005_add_quotation_models.py` |
| Server Actions | `src/app/actions/quotations.ts` |
| Page | `src/app/(privileged)/sales/quotations/page.tsx` |
| Manager | `src/app/(privileged)/sales/quotations/manager.tsx` |

## Tables Affected
| Table | Purpose |
|-------|---------|
| `pos_quotation` | Quotation headers |
| `pos_quotation_line` | Product lines tied to quotations |
| `pos_order` | Orders created from converted quotations |
| `pos_orderline` | Order lines copied from quotation lines |
