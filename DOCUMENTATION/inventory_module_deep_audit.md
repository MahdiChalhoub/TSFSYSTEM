# Inventory Module — Deep Audit Report (Pass 2)

## Goal
Deep second-pass audit of the Inventory module, focusing on frontend-backend contract mismatches, missing business logic, stale code comments, and missing features.

## Version
`v1.3.2-b023`

---

## Files Modified

| File | Fixes |
|------|-------|
| `services.py` | Added `transfer_stock()` method |
| `views.py` | Added `transfer_stock` endpoint |
| `movements.ts` | Added `transferStock` frontend action, cleaned imports |
| `categories.ts` | D3: Fixed move_products field names (camelCase → snake_case) |
| `product-groups.ts` | D4: Fixed updateProductGroup HTTP method (POST → PUT) |
| `attributes.ts` | Cleaned stale TODO comments about M2M serializer writes |
| `brands.ts` | Cleaned stale TODO comments about missing model fields |
| `maintenance.ts` | D7: Added inline field documentation |

---

## Key Fixes

### D3: `categories.ts` — move_products was silently broken
- Frontend sent `productIds` (camelCase), backend expected `product_ids` (snake_case)
- Products were never actually moved — the endpoint received empty values

### D4: `product-groups.ts` — update used wrong HTTP method
- Frontend sent POST, backend `update_with_variants` only accepts PUT
- All product group updates were returning 405 Method Not Allowed

### New: Stock Transfer Capability
- `InventoryService.transfer_stock()` — atomic warehouse-to-warehouse transfers
- Creates paired TRANSFER movements (negative OUT, positive IN) with same reference
- Validates sufficient stock at source, prevents same-warehouse transfers
- Endpoint: `POST /inventory/transfer_stock/`
- Frontend: `transferStock()` in `movements.ts`

---

## Data Flow Summary

### Stock Reception
```
Frontend → movements.ts/receiveStock() → POST inventory/receive_stock/
→ views.py validates org ownership → services.py/receive_stock()
→ AMC recalculation → Inventory update → InventoryMovement(IN) created
→ Journal entry created (if finance module available)
```

### Stock Adjustment
```
Frontend → movements.ts/adjustStock() → POST inventory/adjust_stock/
→ views.py validates org ownership → services.py/adjust_stock()
→ Inventory update (no AMC change) → InventoryMovement(ADJUSTMENT) created
```

### Stock Transfer (NEW)
```
Frontend → movements.ts/transferStock() → POST inventory/transfer_stock/
→ views.py validates product + both warehouses + org ownership
→ services.py/transfer_stock()
→ Source deducted, destination credited
→ Paired InventoryMovement(TRANSFER) records created
```

### Category Move Products
```
Frontend → categories.ts/moveProducts() → POST categories/move_products/
→ views.py reads product_ids, target_category_id (FIXED from camelCase)
→ Bulk update product.category_id
```
