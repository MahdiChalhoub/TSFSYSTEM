# Delivery Management System

## Delivery Orders

### Goal
Track and manage order deliveries through a full lifecycle (PENDING → PREPARING → IN_TRANSIT → DELIVERED / FAILED / CANCELLED).

### Page: `/sales/deliveries`

#### Data READ
- `GET /pos/deliveries/` — all delivery orders

#### Data WRITE (status transitions)
- `POST /pos/deliveries/{id}/dispatch/` — marks as IN_TRANSIT, sets dispatched_at
- `POST /pos/deliveries/{id}/deliver/` — marks as DELIVERED, sets delivered_at
- `POST /pos/deliveries/{id}/fail/` — marks as FAILED, accepts reason in body
- `POST /pos/deliveries/{id}/cancel/` — marks as CANCELLED

#### Variables
- **statusFilter**: PENDING, PREPARING, IN_TRANSIT, DELIVERED, FAILED, CANCELLED
- **search**: order ref, recipient name, contact name, tracking code, city, driver

#### Workflow
1. 4 KPI cards: Total Deliveries, Pending/Preparing, In Transit, Delivered
2. Status filter tags with counts + total fee display
3. Delivery table: ID, Status badge (with icon), Order ref, Recipient (name + city + phone), Zone, Driver, Tracking code, Fee, Created date
4. Action buttons per row based on status:
   - PENDING/PREPARING → Dispatch, Fail, Cancel
   - IN_TRANSIT → Deliver, Fail, Cancel
   - DELIVERED/FAILED/CANCELLED → "Final" label
5. Recent Delivery Activity timeline (last 10 dispatched/delivered)

---

## Delivery Zones

### Goal
CRUD management for delivery zones with base fees and estimated transit times.

### Page: `/sales/delivery-zones`

#### Data READ
- `GET /pos/delivery-zones/` — all delivery zones

#### Data WRITE
- `POST /pos/delivery-zones/` — create new zone
- `PATCH /pos/delivery-zones/{id}/` — update zone
- `DELETE /pos/delivery-zones/{id}/` — delete zone

#### Variables
- **showForm**: boolean for create/edit form visibility
- **editId**: null for create, zone ID for edit
- **form**: name, description, base_fee, estimated_days, is_active

#### Workflow
1. 3 KPI cards: Total Zones (active count), Avg Base Fee, Avg Transit days
2. "Add Zone" button opens inline form
3. Create/Edit form: Name, Description, Base Fee (XOF), Estimated Days, Active toggle
4. Zone cards grid layout: Zone name + description, Base Fee, Estimated Transit, Active/Inactive badge
5. Edit/Delete buttons on each zone card

## Backend Models
- `DeliveryZone`: name, description, base_fee, estimated_days, is_active
- `DeliveryOrder`: order (FK), zone (FK), status, recipient_name, address_line1/2, city, phone, tracking_code, delivery_fee, driver (FK), scheduled_date, dispatched_at, delivered_at, notes

## Files
- `erp_backend/apps/pos/delivery_models.py` — Django models
- `erp_backend/apps/pos/serializers.py` — DeliveryZoneSerializer, DeliveryOrderSerializer
- `erp_backend/apps/pos/views.py` — DeliveryZoneViewSet, DeliveryOrderViewSet
- `src/app/(privileged)/sales/deliveries/page.tsx` — Delivery Orders frontend
- `src/app/(privileged)/sales/delivery-zones/page.tsx` — Delivery Zones frontend
