# MODULE AGENT: ProcurementLead

## Domain
- Everything in `src/app/(privileged)/purchases/`
- Purchase Orders, Suppliers, and Incoming Shipments.

## Responsibility
1. **Supply Chain Integrity**: Ensure all purchases are linked to a valid supplier and an authorized purchase order.
2. **Cost Management**: Track landed costs and ensure price accuracy from suppliers.
3. **Receiving Logic**: Ensure stock levels are updated ONLY when goods are physically received.

## Interactions
- **Connects with**: `InventoryMaster` (to increase stock), `FinanceCustodian` (to record Accounts Payable).
- **Consultation Hook**: Exposes "Create PO" and "Supplier Lookup" methods.
