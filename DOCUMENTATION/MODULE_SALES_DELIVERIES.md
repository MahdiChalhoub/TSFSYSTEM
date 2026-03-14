# Delivery / Shipment — Documentation

## Goal
Track physical delivery of goods from sale orders to customer locations, with lifecycle tracking, zones, fees, and driver assignment.

## Data Sources

### READ
- `GET /api/delivery-zones/` — list delivery zones
- `GET /api/deliveries/` — list all deliveries
- `GET /api/deliveries/{id}/` — single delivery detail

### WRITE
- `POST /api/delivery-zones/` — create zone
- `POST /api/deliveries/` — create delivery from an order
- `POST /api/deliveries/{id}/dispatch/` — PENDING/PREPARING → IN_TRANSIT
- `POST /api/deliveries/{id}/deliver/` — IN_TRANSIT → DELIVERED
- `POST /api/deliveries/{id}/fail/` — → FAILED
- `POST /api/deliveries/{id}/cancel/` — → CANCELLED

## Lifecycle
```
PENDING → PREPARING → IN_TRANSIT → DELIVERED
                ↓           ↓
              FAILED      FAILED
              CANCELLED   CANCELLED
```

## Files
| Layer | File |
|-------|------|
| Models | `erp_backend/apps/pos/delivery_models.py` |
| Serializers | `erp_backend/apps/pos/serializers.py` |
| Views | `erp_backend/apps/pos/views.py` (DeliveryZoneViewSet, DeliveryOrderViewSet) |
| Migration | `erp_backend/apps/pos/migrations/0006_add_delivery_models.py` |
| Server Actions | `src/app/actions/deliveries.ts` |
| Page | `src/app/(privileged)/sales/deliveries/page.tsx` |
| Dashboard | `src/app/(privileged)/sales/deliveries/dashboard.tsx` |

## Tables
| Table | Purpose |
|-------|---------|
| `delivery_zone` | Named zones with base fees |
| `delivery_order` | Individual delivery tracking records |
