# Deep Audit — Structural & Resilience Fixes

## Goal
Fix critical structural issues found during Level 2 Deep Audit: unvalidated server actions, unhandled promises, memory leaks, and silent error swallowing.

## What Changed

### 1. Zod Validation Added to 13 Server Actions
Every mutation action that accepted `data: any` now validates input with a Zod schema before API call.

| File | Functions |
|------|-----------|
| `finance/ledger.ts` | `createJournalEntry`, `updateJournalEntry`, `createOpeningBalanceEntry` |
| `finance/accounts.ts` | `createFinancialAccount`, `createAccount`, `updateChartOfAccount` |
| `finance/fiscal-year.ts` | `updatePeriod` |
| `crm/contacts.ts` | `createContact`, `updateContact` |
| `saas/mcp.ts` | `updateMCPProvider`, `createMCPTool`, `updateMCPTool` |

**Data flow:** Page form → server action → Zod validates → erpFetch → Django API

### 2. Unhandled `.then()` Chains Fixed
Added `.catch()` to prevent silent promise rejections:
- `login/page.tsx` — `getPublicConfig().then(setConfig).catch(() => {})`
- `register/user/page.tsx` — same pattern
- `register/business/page.tsx` — same pattern
- `(saas)/modules/page.tsx` — `getModuleBackups().then(...)` → `.catch(() => setLoading(false))`

### 3. Offline Manager Memory Leak Fixed
- `offline-manager.ts` — `window.addEventListener('online', ...)` now stored and cleaned up via new `cleanup()` method

### 4. Silent Catch Block Fixed
- `auth.ts` logout — `catch (e) { }` → `catch (e) { console.error('...', e) }`

### 5. Temp ID Collision Fixed
- `GroupedProductForm.tsx` — `Date.now()` → `Date.now() + Math.random()` for variant temp IDs

## Variables
- `JournalEntrySchema` — validates lines array (accountId, debit, credit), description, date, scope
- `CoaAccountSchema` — validates code, name, type, syscohada fields
- `FinancialAccountSchema` — validates name, type, siteId, currency
- `PeriodUpdateSchema` — validates name, dates, status
- `ContactSchema` — validates name, type, email, phone
- `MCPProviderUpdateSchema` — validates name, API fields, model config
- `MCPToolSchema` — validates name, description, parameters_schema

## Step-by-Step
1. User submits form → server action receives `data: unknown`
2. Zod schema validates structure → throws `ZodError` if invalid
3. Frontend catches `ZodError` and displays field-level errors
4. On valid data → action sends to Django API via `erpFetch`
