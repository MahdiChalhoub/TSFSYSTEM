
# Serial Number Tracking Documentation

## Goal
Track individual units of high-value inventory (e.g., Electronics, IMEI) through their entire lifecycle in the system.

## Data Movement
### Read From
- `inventory.Product`: `tracks_serials` toggle.
- `inventory.ProductSerial`: Current status and location.

### Saved To
- `inventory.ProductSerial`: New serial entries.
- `inventory.SerialLog`: Audit trail of every movement.

## User Interactions
- **Product Setup**: User toggles "Tracks Serials" on a product.
- **Reception**: When receiving stock, user MUST enter serial numbers for each unit.
- **Sale**: When selling, user selects the specific serial number from the available list.
- **History View**: User views the audit trail of a specific serial number.

## Workflow Step-by-Step
1. **Enabling**: Admin turns on serial tracking for a Product.
2. **Inbound**:
   - During Stock Reception (Purchase), system blocks progress until serials are assigned.
   - For each serial, a `ProductSerial` record is created with `status='AVAILABLE'`.
   - A `SerialLog` entry is created: "PURCHASE - Ref: PO-123".
3. **Outbound**:
   - At POS checkout, if a product tracks serials, a modal pops up.
   - User scans or selects a serial.
   - System confirms serial exists in that warehouse.
   - Upon payment, `ProductSerial` status changes to `'SOLD'`.
   - A `SerialLog` entry is created: "SALE - Ref: INV-456".
4. **Tracking**: Admin can search for a serial number to see when it was purchased, where it was stored, and when it was sold.

## How it Achieves Goal
By enforcing unit-level identifiers, it prevents inventory shrinkage and enables warranty tracking.
