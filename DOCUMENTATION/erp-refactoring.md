# Django ERP Integration - Refactoring Documentation

## Goal
The goal of this refactoring was to migrate core ERP logic (Inventory & Finance) from local Prisma/Next.js implementation to a centralized Django-based ERP backend. This ensures consistency, better performance for accounting calculations, and a shared source of truth for multi-tenant data.

## Module: Finance Actions
- **File**: `src/app/actions/finance/accounts.ts`, `ledger.ts`, `posting-rules.ts`, `settings.ts`
- **Goal**: Provide server actions for Chart of Accounts, Journal Entries, Reporting, and Financial Settings using the Django API.
- **Data Movement**:
    - **READ**: Calls Django API via `erpFetch`.
    - **SAVE**: Sends POST/PATCH requests to Django endpoints.
- **Step-by-step Workflow**:
    1. UI calls a server action (e.g., `getChartOfAccounts`).
    2. Server action performs `erpFetch` to the corresponding Django route (e.g., `coa/coa/`).
    3. Django `LedgerService` processes the request (calculating rollups, filtering by scope).
    4. Data is returned to the UI, serialized for Next.js.

## Module: Inventory Actions
- **File**: `src/app/actions/inventory.ts`, `inventory/warehouses.ts`, `inventory/viewer.ts`, `inventory/product-actions.ts`
- **Goal**: Manage stock movement, warehouse configuration, and global inventory visibility via Django.
- **Data Movement**:
    - **READ**: Fetches valuation and stock levels from Django `InventoryService`.
    - **SAVE**: Records stock reception and adjustments in Django.
- **Step-by-step Workflow**:
    1. User performs an action (e.g., "Receive Stock").
    2. Server action `receive_stock` calls Django `InventoryViewSet.receive_stock`.
    3. Django updates balances and creates accounting entries automatically.

## Module: SaaS / Sites
- **File**: `src/app/actions/sites.ts`, `src/app/admin/saas/organizations/actions.ts`
- **Goal**: Manage multi-tenant sites and organization provisioning.
- **Data Movement**:
    - **READ**: Lists available sites and organizations.
    - **SAVE**: Provision new tenants or update site details.

## Variables User Interacts With
- `scope`: ('INTERNAL' | 'OFFICIAL') for accounting views.
- `transaction_date`: For journal entries.
- `quantity`, `cost_price_ht`: For inventory reception.

## How it achieves its goal
By abstracting the database layer into the Django service layer, the Next.js frontend becomes a lightweight consumer. Complex logic like AMC (Average Moving Cost) and Hierarchical Account Rollups are handled by Django's robust query system, reducing overhead in the frontend.
