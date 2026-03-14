# Subscription System Documentation

## Overview
The Subscription System manages the billing, feature entitlement, and access control for the multi-tenant SaaS platform. It allows the SaaS Provider to define plans and allows Tenants to subscribe, upgrade, and manage their billing.

## Workflows

### 1. Plan Creation (Admin)
- **Goal**: Define a new pricing tier.
- **Actors**: SaaS Administrator.
- **Steps**:
  1. Admin navigates to `/saas/subscription-plans`.
  2. Admin clicks "New Plan" (Future).
  3. Admin enters Name, Price, Limits, and Features.
- **Data Movement**: Writes to `SubscriptionPlan` table.

### 2. Tenant Upgrade/Subscription
- **Goal**: Unlock features by purchasing a plan.
- **Actors**: Tenant Administrator.
- **Steps**:
  1. User navigates to `/saas/subscription`.
  2. User clicks "Upgrade Plan".
  3. User selects a plan from the list.
  4. System records `SubscriptionPayment` (Completed).
  5. System runs `SubscriptionService.activate_plan`.
  6. `Organization.current_plan` is updated.
- **Data Movement**:
  - Creates `SubscriptionPayment`.
  - Updates `Organization`.
  - Creates `JournalEntry` in SaaS Provider's Ledger (Revenue).

### 3. Expiry Processing
- **Goal**: Restrict access for expired subscriptions.
- **Actors**: System (Cron/Management Command).
- **Steps**:
  1. Run `python manage.py expire_subscriptions`.
  2. System finds organizations with `plan_expiry_at < now`.
  3. System sets `is_read_only = True`.
- **Tables Affected**: `Organization`.

## Database Tables

### SubscriptionPlan
- **Purpose**: Defines pricing tiers.
- **Columns**: `name`, `slug`, `monthly_price`, `annual_price`, `features` (JSON), `limits` (JSON).
- **Relationships**: One-to-Many with `Organization`.

### SubscriptionPayment
- **Purpose**: Records financial transactions for subscriptions.
- **Columns**: `organization`, `plan`, `amount`, `status`, `paid_at`.
- **Relationships**: FK to `Organization`, FK to `SubscriptionPlan`.

### Organization (Updated)
- **Columns Added**: `current_plan`, `plan_expiry_at`, `is_read_only`, `billing_contact_id`.
