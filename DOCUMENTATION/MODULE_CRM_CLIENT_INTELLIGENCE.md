# Client Intelligence — Documentation

## Goal
Provide enriched contact detail views with purchase analytics, top products, and pricing rule visibility. Helps staff understand a contact's purchasing behaviour and active price rules at a glance.

## Data Sources

### READ
- **Contact Detail** (`GET /api/contacts/{id}/summary/`) — enhanced with:
  - `analytics`: avg order value, monthly frequency, total revenue, top products
  - `pricing_rules`: all active price rules (direct + group-based) for this contact

### WRITE
- No writes — analytics is read-only. Pricing rules are managed from the Client Pricing page.

## Enriched Contact Fields Displayed
| Field | Where Shown |
|-------|-------------|
| `supplier_category` | Badge in header (DEPOT_VENTE → Consignment, MIXED → Mixed) |
| `customer_tier` | Badge in header (VIP with ⭐, WHOLESALE, RETAIL) |
| `payment_terms_days` | Contact info card |
| `loyalty_points` | Contact info card (with ⭐ icon) |

## Analytics Tab
- **Avg Order Value**: Total amount ÷ total orders
- **Monthly Frequency**: Orders in last 12 months ÷ 12
- **Total Revenue**: Lifetime sum of order amounts
- **Top Products**: Top 5 products by revenue (name, qty, revenue), aggregated from OrderLine

## Pricing Tab
- Shows all active `ClientPriceRule` records for this contact
- Includes direct rules (contact_id match) and group rules (via PriceGroupMember)
- Each rule displays: discount type badge, value, product/category scope, group source

## Files
- **Backend**: `erp_backend/apps/crm/views.py` (`_build_analytics`, `_get_pricing_rules`)
- **Frontend**: `src/app/(privileged)/crm/contacts/[id]/page.tsx` (Analytics + Pricing tabs)
