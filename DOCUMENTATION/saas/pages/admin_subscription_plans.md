# Admin Subscription Plans Page

**Path**: `/saas/subscription-plans`

## Goal
Allow SaaS Administrators to view and manage subscription plans.

## Data Sources
- **Read**: 
  - `SubscriptionPlan` (via `getPlans`).
  - `PlanCategory` (via `getPlanCategories`).
- **Write**:
  - `SubscriptionPlan` (Future: Create/Edit).

## User Interaction
- **Listing**: View plans grouped by category.
- **Status**: See active/inactive status.
- **Pricing**: View monthly/annual pricing.

## Workflow
1. Page loads `getPlans` and `getPlanCategories`.
2. Plans are rendered in a grid card layout.
3. Empty states are handled per category.
