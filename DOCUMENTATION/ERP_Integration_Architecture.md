# ERP API Integration Documentation

## Overview
The TSF System uses a hybrid architecture with a Next.js frontend and a Django ERP Core backend. Communication is abstracted through a central utility that handles tenant context and routing.

## Technology Stack
- **Frontend**: Next.js 14+ (App Router, Server Actions)
- **Backend**: Django 5+ (Django REST Framework)
- **Shared Data**: PostgreSQL (Centralized instance)
- **Context Management**: HTTP Headers (`X-Tenant-Id`, `X-Tenant-Slug`)

## API Client: `erpFetch`
Located in `src/lib/erp-api.ts`.

### Goal
- Transparently route Next.js server actions to Django.
- Automatically resolve and inject tenant context.
- Handle backend errors and rejections.

### Usage Pattern
```typescript
import { erpFetch } from "@/lib/erp-api"

export async function myServerAction(data: any) {
    const result = await erpFetch('endpoint/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    return result
}
```

## Module Integrations

### 1. Finance (Ledger & Chart of Accounts)
- **Actions**: `src/app/actions/finance/ledger.ts`, `accounts.ts`
- **Django ViewSets**: `JournalEntryViewSet`, `FinancialAccountViewSet`
- **Business Logic**: `LedgerService` handles double-entry validation and AMC synchronization.

### 2. Inventory (Movements & Valuation)
- **Actions**: `src/app/actions/inventory/movements.ts`
- **Django ViewSets**: `InventoryViewSet` (with custom `@action` for movements)
- **Logic**: Moving Average Cost (AMC) is calculated in Django's `InventoryService`.

### 3. SaaS Control Plane (Provisioning)
- **Actions**: `src/app/admin/saas/organizations/actions.ts`
- **Provisioning**: Handled by `ProvisioningService` in Django, ensuring consistent default setup (Sites, Accounts) for new tenants.

## Implementation Workflow
1. Define Logic in Django `services.py`.
2. Expose via DRF `views.py`.
3. Wrap in Next.js Server Action using `erpFetch`.
4. Update UI to call the Server Action.

## Security & Isolation
- **Tenant Context**: Injected by `erpFetch` from the requester's hostname.
- **Django Middleware**: Filters all querysets using `X-Tenant-Id` before any logic executes.
- **Safety**: Prevents cross-tenant data leaks at the database query level.
