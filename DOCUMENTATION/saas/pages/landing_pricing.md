# Landing Page Pricing Section

**Component**: `PricingSection.tsx`
**Location**: `src/app/landing/page.tsx`

## Goal
Display available public subscription plans to visitors to encourage sign-up.

## Data Sources
- **Read**: `SubscriptionPlan` (via `getPublicPlans` action).

## Behavior
- Fetches all public plans via unauthenticated API call.
- Renders pricing cards with features list.
- Uses glassmorphism style to match Landing Page aesthetic.
- "Select Strategy" button (currently placeholder for recruitment flow).
