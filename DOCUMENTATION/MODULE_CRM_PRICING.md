# Client-Specific Pricing — Documentation

## Goal
Enable per-client and per-group price overrides. When a sale is made, the POS checks if the client has any active price rules and applies the best match.

## Database Tables

### `price_group`
| Column | Type | Description |
|--------|------|-------------|
| `name` | VARCHAR(100) | Group name (e.g., VIP, Wholesale) |
| `description` | TEXT | Optional description |
| `priority` | INT | Higher priority wins when overlap |
| `is_active` | BOOL | Active flag |
| `valid_from` | DATE | Optional start date |
| `valid_until` | DATE | Optional end date |

### `price_group_member`
| Column | Type | Description |
|--------|------|-------------|
| `price_group_id` | FK→PriceGroup | Parent group |
| `contact_id` | INT | Contact in this group |
| Unique: `(price_group, contact_id, organization)` |

### `client_price_rule`
| Column | Type | Description |
|--------|------|-------------|
| `contact_id` | INT (nullable) | Specific contact target |
| `price_group_id` | FK (nullable) | Group target |
| `product_id` | INT (nullable) | Specific product scope |
| `category_id` | INT (nullable) | Category scope |
| `discount_type` | ENUM | FIXED_PRICE, PERCENTAGE, AMOUNT_OFF |
| `value` | DECIMAL | Price, percentage, or amount |
| `min_quantity` | INT | Minimum quantity (default 1) |
| `is_active` | BOOL | Active flag |
| `valid_from/until` | DATE | Validity dates |
| `notes` | TEXT | Internal notes |

## Data Flow

### READ
- **Pricing Page** (`/crm/pricing`) — `GET /api/price-groups/` and `GET /api/price-rules/`
- **POS Checkout** — `GET /api/price-rules/for-contact/{id}/` to find applicable rules
- **Product Detail** — `GET /api/price-rules/for-product/{id}/`

### WRITE
- **Create Group** — `POST /api/price-groups/`
- **Add Member** — `POST /api/price-groups/{id}/members/`
- **Create Rule** — `POST /api/price-rules/`

## User Interactions
- Tab switcher: Price Groups / Price Rules
- Search across both tabs
- Create Group: name, description, priority
- Create Rule: discount type, value, min qty, target (contact OR group), scope (product OR category)
- Delete group/rule with confirmation

## Workflow
1. Create Price Groups (e.g., VIP, Wholesale)
2. Add contacts as members to groups
3. Create Price Rules: assign discounts to groups or specific contacts
4. During POS checkout, system queries `for-contact/{id}` and applies best matching rule

## Files
- **Backend**: `erp_backend/apps/crm/pricing_models.py`, `pricing_serializers.py`, `pricing_views.py`
- **Frontend**: `src/app/(privileged)/crm/pricing/page.tsx`, `manager.tsx`
- **Actions**: `src/app/actions/pricing.ts`
- **URLs**: `erp_backend/apps/crm/urls.py` (updated)
