# Type Safety Pass: Sales, Purchases, HR, Products, Users

## Goal
Eliminate all `useState<any>` instances across the Sales, Purchases, HR, Products, and Users modules by defining and applying proper TypeScript interfaces.

## Types Defined/Updated in `src/types/erp.ts`

### Updated Existing Types (index signatures + optional fields added)
- **SalesOrder** — added `ref_code`, `invoice_number`, `contact_name`, `type`, `total_amount`, `created_at`, `lines`, index signature
- **SalesReturn** — added `total_refund`, made most fields optional, index signature
- **DeliveryOrder** — added `order_ref`, `recipient_name`, `contact_name`, `city`, `phone`, `zone_name`, `driver_name`, `tracking_code`, `delivery_fee`, `dispatched_at`, `delivered_at`
- **DeliveryZone** — added `description`, `base_fee`, `estimated_days`, index signature
- **DiscountRule** — added `code`, `discount_type`, `scope`, `max_discount`, `min_order_amount`, `auto_apply`, `usage_limit`, `priority`, `product`, `category`, `brand`
- **PurchaseOrder** — added `ref_code`, `contact_name`, `created_at`, `total_amount`, `payment_method`, index signature
- **PurchaseReturn** — added `total_amount`, made most fields optional
- **Employee** — added `first_name`, `last_name`, `employee_id`, `employee_type`, `job_title`, `is_active`
- **UserApproval** — added `first_name`, `last_name`, made fields optional, index signature

### New Types Added
- **ImportResult** — for sales CSV import results
- **UsageLog** — for discount rule usage tracking
- **SalesAnalyticsData** — for sales analytics dashboard
- **PurchaseLine** — for purchase order line items
- **Category** — for product categories
- **Brand** — for product brands
- **ProductAttribute** — for product attributes

## Files Modified

### Sales Module (8 files)
| File | Variable | Type Applied |
|------|----------|-------------|
| `sales/returns/page.tsx` | `returns` | `SalesReturn[]` |
| `sales/returns/new/page.tsx` | `order` | `SalesOrder \| null` |
| `sales/history/page.tsx` | `orders` | `SalesOrder[]` |
| `sales/discounts/page.tsx` | `rules` | `DiscountRule[]` |
| `sales/discounts/page.tsx` | `usageLogs` | `UsageLog[]` |
| `sales/discounts/page.tsx` | `products` | `Record<string, unknown>[]` |
| `sales/discounts/page.tsx` | `categories` | `Category[]` |
| `sales/discounts/page.tsx` | `brands` | `Brand[]` |
| `sales/delivery-zones/page.tsx` | `zones` | `DeliveryZone[]` |
| `sales/deliveries/page.tsx` | `deliveries` | `DeliveryOrder[]` |
| `sales/analytics/page.tsx` | `data` | `SalesAnalyticsData \| null` |
| `sales/import/SalesMapper.tsx` | `results` | `ImportResult \| null` |

### Purchases Module (4 files)
| File | Variable | Type Applied |
|------|----------|-------------|
| `purchases/returns/page.tsx` | `returns` | `PurchaseReturn[]` |
| `purchases/returns/new/page.tsx` | `order` | `PurchaseOrder \| null` |
| `purchases/new-order/form.tsx` | `availableWarehouses` | `Record<string, unknown>[]` |
| `purchases/new-order/form.tsx` | `lines` | `PurchaseLine[]` |
| `purchases/new-order/form.tsx` | `results` | `Record<string, unknown>[]` |
| `purchases/new/form.tsx` | `availableWarehouses` | `Record<string, unknown>[]` |
| `purchases/new/form.tsx` | `lines` | `PurchaseLine[]` |
| `purchases/new/form.tsx` | `results` | `Record<string, unknown>[]` |
| `purchases/dashboard/page.tsx` | `orders` | `PurchaseOrder[]` |

### HR Module (2 files)
| File | Variable | Type Applied |
|------|----------|-------------|
| `hr/payroll/page.tsx` | `employees` | `Employee[]` |
| `hr/employees/manager.tsx` | `scopeEmployee` | `Employee \| null` |

### Products Module (1 file)
| File | Variable | Type Applied |
|------|----------|-------------|
| `products/new/form.tsx` | `filteredAttributes` | `ProductAttribute[]` |

### Users Module (1 file)
| File | Variable | Type Applied |
|------|----------|-------------|
| `users/approvals/page.tsx` | `users` | `UserApproval[]` |
| `users/approvals/page.tsx` | `correctionUser` | `UserApproval \| null` |

## Verification
- **Build**: `npx next build` — Exit code 0 ✅
- **No duplicate type declarations** in `erp.ts`
- **All imports resolved** correctly
