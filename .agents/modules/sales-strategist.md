# MODULE AGENT: SalesStrategist

## Domain
- Everything in `src/app/(privileged)/sales/` and `src/app/(privileged)/ecommerce/`
- POS Layouts: `src/components/pos/layouts/` (Classic, Modern, Compact)
- POS Components: `src/components/pos/` (Toolbar, ProductGrid, TicketSidebar, etc.)
- POS Hooks: `src/hooks/pos/` (usePOSTerminal, TerminalContext, useBarcodeScanner)
- POS Types: `src/types/pos-layout.ts` (POSLayoutProps, POSLayoutVariant)
- POS Actions: `src/app/(privileged)/sales/actions.ts`
- Backend: `erp_backend/apps/pos/`

## Pre-Work Protocol (POS-Specific)
The POS system has a complex data flow. Before ANY POS edit:

1. **Read `src/types/pos-layout.ts`** — This is the canonical interface for all layout components.
2. **Read `src/hooks/pos/usePOSTerminal.ts`** — This is the state engine. EVERY field a layout uses comes from here.
3. **Understand the prop chain**:
   ```
   usePOSTerminal() → TerminalContext → useTerminal() → Layout destructures
   ```
4. **Check ALL THREE layouts** when changing the hook:
   - `POSLayoutClassic.tsx`
   - `POSLayoutModern.tsx`
   - `POSLayoutCompact.tsx`
5. **Verify after EACH edit**: `npx tsc --noEmit 2>&1 | grep "POSLayout"`

## ⚠️ Known Gotchas (from past bugs)
1. **Session ID Types**: `activeTicketId` is `string | null` (UI), `activeRegisterSessionId` is `number | null` (DB). Don't mix them.
2. **Handler Aliases**: Layouts expect `onSetSearchQuery` but the hook has `setSearchQuery`. All aliases are defined at the bottom of `usePOSTerminal`.
3. **onCharge signature**: `onCharge(skipWarning?: boolean)` — don't pass it as `onClick={onCharge}` because MouseEvent ≠ boolean. Use `onClick={() => onCharge()}`.
4. **clearCart signature**: `clearCart(force?: boolean)` — same wrapping rule applies.
5. **ManagerOverride props**: Uses `onSuccess` + `actionLabel`, NOT `onVerify` or `action`.
6. **deliveryZone nullability**: `deliveryZone` can be `null`, but `<select value>` doesn't accept `null`. Use `value={deliveryZone || ''}`.

## Responsibility
1. **Transaction Speed**: Ensure the POS/Sales interface is fast and responsive.
2. **Pricing Logic**: Apply discounts, price lists, and promotions correctly.
3. **Closing the Loop**: Ensure every order results in either a payment or a receivable.
4. **CRM Sync**: Update customer history after every successful sale.
5. **Dynamic COA Resolution** *(CRITICAL)*: POS checkout, COGS posting, and A/R clearance all create journal entries. **NEVER** hardcode COA codes — always resolve from `ConfigurationService.get_posting_rules()`. Missing rules must raise `WorkflowError` or `ValidationError`. Run `/posting-rules-enforcement` workflow before any POS financial code change.

## Interactions
- **Connects with**: `InventoryMaster` (to deduct stock), `FinanceCustodian` (to record revenue).
- **Consultation Hook**: Exposes "Create Order" and "Calculate Total" methods.
