# Type Safety Infrastructure — `types/erp.ts`

## Goal
Eliminate `useState<any>` across the frontend to improve type safety, refactoring resilience, and IDE autocompletion.

## What Changed

### New File: `src/types/erp.ts`
Centralized type definitions for all ERP domain entities:

| Module | Interfaces | Key Types |
|--------|-----------|-----------|
| Finance | 20 | ChartOfAccount, Voucher, JournalEntry, FiscalYear, Payment, Asset |
| Inventory | 12 | Product, Warehouse, TransferOrder, AdjustmentOrder, ValuationData |
| Sales | 10 | SalesOrder, SalesReturn, DeliveryOrder, DiscountRule, SalesAnalytics |
| Purchases | 4 | PurchaseOrder, PurchaseReturn |
| CRM/HR | 5 | Contact, Employee, UserApproval |
| Common | 1 | PaginatedResponse<T> |

### Pages Typed (Phase 1)
| Page | useState<any> removed | Types used |
|------|----------------------|------------|
| `finance/vouchers/page.tsx` | 5 | Voucher, FinancialAccount, FinancialEvent, LifecycleHistoryEntry |
| `finance/fiscal-years/page.tsx` | 2 | FiscalYear, inline gap type |
| `finance/fiscal-years/year-card.tsx` | 1 | FiscalPeriod |
| `finance/accounts/page.tsx` | 1 | ChartOfAccount |

## Data Flow
All types live in `src/types/erp.ts`. Pages import via:
```ts
import type { Voucher, ChartOfAccount } from '@/types/erp'
```
Types are designed to match Django API response shapes including snake_case fields.

## For Future Development
- Import from `@/types/erp` whenever creating new pages
- ~125 remaining `useState<any>` instances can be incrementally replaced using these types
- Each interface has an optional `[key: string]: unknown` index signature where needed for API flexibility
