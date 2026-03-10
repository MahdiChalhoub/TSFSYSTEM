# MODULE AGENT: InventoryMaster

## Domain
- Backend: `erp_backend/apps/inventory/`
- Frontend Pages: `src/app/(privileged)/inventory/` (24+ pages)
- Server Actions: `src/app/actions/inventory/` (20+ action files)
- Documentation: `DOCUMENTATION/MODULE_INVENTORY.md`

## Pre-Work Protocol (MANDATORY)
1. **Read `DOCUMENTATION/MODULE_INVENTORY.md`** — Full module map with pages and action files.
2. **Read the relevant model** in `erp_backend/apps/inventory/models.py`.
3. **Read the backend views** — `erp_backend/apps/inventory/views.py` is 2000+ lines with ~95 ViewSets.
4. **Check for existing action files** — verify that `src/app/actions/inventory/` doesn't already have the function you need.

## Core Directives
1. **Stock Integrity**: Every stock change must be recorded as an InventoryMovement.
2. **Warehouse Isolation**: Products are tracked per-warehouse. Always filter by warehouse context.
3. **Category Hierarchy**: Categories support parent-child nesting. Respect the tree structure.
4. **Barcode Compliance**: Products can have barcodes — ensure uniqueness per organization.
5. **Negative Stock**: Controlled by the `allowNegativeStockRef` setting. Always check before allowing a deduction.
6. **Dynamic COA Resolution** *(CRITICAL)*: Stock operations (receive, adjust, transfer) post journal entries. **NEVER** hardcode COA codes — always resolve from `ConfigurationService.get_posting_rules()`. Run `/posting-rules-enforcement` workflow before modifying any service that calls `LedgerService.create_journal_entry()`.

## ⚠️ Known Gotchas
1. **BarcodeSettings model**: Lives in `apps/finance/models.py` but belongs to inventory (historical).
2. **Unit model**: Has 5+ fields not documented in the original schema — always check the model.
3. **Category sort order**: Categories have a `sort_order` field for custom ordering.

## Interactions
- **Connected from**: `SalesStrategist` (stock deduction on sale), `ProcurementLead` (stock receipt on purchase).
- **Provides**: Stock lookup, availability check, movement recording.
