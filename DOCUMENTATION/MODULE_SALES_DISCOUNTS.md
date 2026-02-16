# Discount Rule Engine — Documentation

## Goal
Create configurable promotional discount rules that can auto-apply at POS checkout, with usage tracking and validity controls.

## Data Sources

### READ
- `GET /api/discount-rules/` — list all rules
- `GET /api/discount-rules/active-rules/` — active & valid rules (for checkout)
- `GET /api/discount-rules/{id}/usage-log/` — usage history

### WRITE
- `POST /api/discount-rules/` — create rule
- `PATCH /api/discount-rules/{id}/` — update rule
- `DELETE /api/discount-rules/{id}/` — delete rule
- `POST /api/discount-rules/{id}/toggle/` — toggle active/inactive

## Rule Configuration
| Field | Description |
|-------|-------------|
| discount_type | PERCENTAGE, FIXED, BUY_X_GET_Y |
| scope | ORDER, PRODUCT, CATEGORY, BRAND |
| value | % for percentage, amount for fixed |
| max_discount | Cap for percentage discounts |
| min_order_amount | Minimum order total to qualify |
| min_quantity | Minimum item quantity to qualify |
| auto_apply | Automatically apply at checkout |
| start_date / end_date | Validity period |
| usage_limit | Maximum number of uses |
| priority | Higher = applied first |

## Files
| Layer | File |
|-------|------|
| Models | `erp_backend/apps/pos/discount_models.py` |
| Serializers | `erp_backend/apps/pos/serializers.py` |
| Views | `erp_backend/apps/pos/views.py` (DiscountRuleViewSet) |
| Migration | `erp_backend/apps/pos/migrations/0007_add_discount_models.py` |
| Server Actions | `src/app/actions/discounts.ts` |
| Page | `src/app/(privileged)/sales/discounts/page.tsx` |
| Manager | `src/app/(privileged)/sales/discounts/manager.tsx` |

## Tables
| Table | Purpose |
|-------|---------|
| `pos_discount_rule` | Rule definitions |
| `pos_discount_usage_log` | Per-order usage logs |
