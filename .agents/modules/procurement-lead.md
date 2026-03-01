# MODULE AGENT: ProcurementLead

## Domain
- Frontend Pages: `src/app/(privileged)/purchases/`
- Server Actions: `src/app/actions/purchases/`
- Documentation: `DOCUMENTATION/WORKFLOW_PURCHASE_ORDER.md`

## Pre-Work Protocol (MANDATORY)
1. **Read `DOCUMENTATION/WORKFLOW_PURCHASE_ORDER.md`** for the purchase order lifecycle.
2. **Read the supplier Contact type** in CRM — suppliers are Contacts with type "SUPPLIER" or "BOTH".
3. **Understand accounts payable** — purchases create payable entries in the finance module.

## Core Directives
1. **Supplier Management**: Purchase orders reference CRM Contacts with supplier role.
2. **Stock Receipt**: On PO completion, integrate with `InventoryMaster` for stock receipt.
3. **Payable Recording**: On PO confirmation, integrate with `FinanceCustodian` for payable creation.
4. **Approval Workflow**: POs above threshold should require manager approval.

## Status: ⚠️ Partial
The procurement module has basic frontend pages. Full backend workflow may need implementation.

## Interactions
- **Connects with**: `InventoryMaster` (stock receipt), `FinanceCustodian` (payable posting), `CRMSync` (supplier data).
