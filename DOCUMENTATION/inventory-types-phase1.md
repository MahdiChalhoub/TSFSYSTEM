# Inventory Module — Type Safety Pass (Phase 1)

## Goal
Eliminate all `useState<any>` instances across the Inventory module by replacing them with specific types from `src/types/erp.ts`.

## Scope
- **Files Modified**: 9 inventory page/component files + `src/types/erp.ts`
- **`useState<any>` Replaced**: 20 instances
- **Version**: v9.5.9-b913

## Types Updated in `src/types/erp.ts`

### Existing Interfaces Updated
| Interface | Changes |
|-----------|---------|
| `Product` | Made `sku`, `selling_price_ttc`, `stock_level`, `is_active` optional. Added `cost_price`, `costPrice`, `unit`, `siteStock`, index signature. |
| `Warehouse` | Added `type`, `siteId`, `site` object. Made `is_active` optional. Added index signature. |
| `TransferOrder` | Added `from_warehouse`, `to_warehouse`, `driver`, `is_posted`, `total_qty_transferred`, `reason`, `notes`. Made `reference`, `status`, `lines` optional. Added index signature. |
| `AdjustmentOrder` | Added `warehouse`, `is_posted`, `notes`. Made `reference`, `reason`, `status`, `lines` optional. Added index signature. |
| `OperationalRequest` | Added `description`, `notes`. Made `reference`, `warehouse_id`, `lines` optional. Added index signature. |

### New Interfaces Added
| Interface | Purpose |
|-----------|---------|
| `LifecycleHistoryEntry` | History dialog entries (action, performed_by_name, performed_at, comment) |
| `ValuationResponse` | Stock valuation data (summary + products) |
| `LowStockResponse` | Low stock alerts (stats + products) |
| `ExpiryAlertResponse` | Expiry alert data (stats + alerts) |

## Files Modified

| File | useState Changes | Notes |
|------|-----------------|-------|
| `transfer-orders/page.tsx` | `any[]` → `TransferOrder[]`, `WarehouseType[]`, `Product[]`; `any[] \| null` → `LifecycleHistoryEntry[] \| null` | `Warehouse as WarehouseType` alias to avoid lucide-react icon conflict |
| `adjustment-orders/page.tsx` | `any[]` → `AdjustmentOrder[]`, `Warehouse[]`, `Product[]`; `any[] \| null` → `LifecycleHistoryEntry[] \| null` | |
| `requests/page.tsx` | `any[]` → `OperationalRequest[]`, `Warehouse[]`, `Product[]`; `any \| null` → `OperationalRequest \| null` | |
| `valuation/page.tsx` | `any` → `ValuationResponse \| null`; `any[]` → `WarehouseType[]` | `Warehouse as WarehouseType` alias |
| `warehouses/manager.tsx` | `any` → `WarehouseType \| null` | `Warehouse as WarehouseType` alias |
| `labels/page.tsx` | `any[]` → `Product[]` | |
| `low-stock/page.tsx` | `any` → `LowStockResponse \| null` | |
| `expiry-alerts/page.tsx` | `any` → `ExpiryAlertResponse \| null` | |
| `adjustments/manager.tsx` | `any[]` → `Product[]`; `any \| null` → `Product \| null` | |

## Additional Fixes
- **Warehouse/Lucide naming conflict**: 3 files import both `Warehouse` type and `Warehouse` Lucide icon. Resolved by aliasing `Warehouse as WarehouseType`.
- **Optional `lines` access**: Added nullish coalescing (`?? []`, `?? 0`) for optional `lines` property access in transfer-orders, adjustment-orders, requests pages.
- **Optional index access**: Added `?? 'OPEN'` / `?? 'NORMAL'` fallbacks for `lifecycle_status` and `priority` used as object keys.
- **`parseFloat` type fix**: Wrapped `total_qty_transferred` in `String()` since it can be `number | string | undefined`.

## Build Verification
- ✅ Build passed (exit code 0)
