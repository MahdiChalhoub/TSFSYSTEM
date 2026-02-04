# Tenant Subscription Page

**Path**: `/saas/subscription`

## Goal
Allow tenant administrators to view their current subscription status, usage, and upgrade their plan.

## Data Sources
- **Read**: 
  - `Organization` (via `getOrganizations` action).
  - `SubscriptionPlan` (via `getSubscriptionPlans` action).
- **Write**:
  - `SubscriptionPayment` (via `subscribeToPlan` action).
  - `Organization` (via `subscribeToPlan` action side-effect).

## User Interaction
- **View Status**: User sees current plan badge, expiry date, and usage bars.
- **Upgrade**: User clicks "change Plan" to open the selection modal.
- **Billing**: (Placeholder) "Manage Billing" button.

## Workflow
1. Page loads `getOrganizations` to fetch current tenant context.
2. If Upgrade is clicked, `getSubscriptionPlans` fetches available active plans.
3. On selection, `subscribeToPlan(planId)` is called.
4. UI refreshes to show new plan and status.
