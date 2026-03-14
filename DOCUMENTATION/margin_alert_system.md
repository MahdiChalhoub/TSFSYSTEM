# Margin Alert System (Margin Guard)

## Goal
The goal of the Margin Alert System is to prevent sales from being processed at a price lower than the cost of the product (optionally multiplied by a margin threshold), protecting the organization's profitability.

## Data Movement
- **READ**: Product cost price from `inventory.Product` and `margin_guard_threshold` from `Organization.settings`.
- **SAVED**: Audit logs of blocked sales or price overrides in `forensicauditlog`.

## User Interaction
- Users interact with this system indirectly through the POS interface.
- If a user attempts to sell a product below cost, the system raises a `ValidationError`, which is displayed on the frontend.

## Step-by-Step Workflow
1. User adds a product to the POS cart and sets the selling price.
2. User clicks "Checkout".
3. The `POSService.checkout` method is invoked.
4. For each item, the system fetches the current `cost_price` from the `Product` model.
5. The system calculates the minimum allowed price: `cost_price * threshold`.
6. If `unit_price < minimum_allowed_price`, a `ValidationError` is raised.
7. The transaction is rolled back, and the user is alerted on the POS screen.

## How it achieves its goal
By enforcing a hard validation check at the service level (backend), it makes it impossible to bypass the price protection even if the frontend validation is tampered with.
