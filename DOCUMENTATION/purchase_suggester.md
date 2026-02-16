# Smart Purchase Suggestions

## Goal
The goal of the Smart Purchase Suggestions feature is to provide the inventory manager with data-driven recommendations for stock reordering, based on historical sales velocity and current stock levels.

## Data Movement
- **READ**: Historical sales movements from `inventory.InventoryMovement` (Type: OUT), current stock levels from `inventory.Inventory`, and product metadata (Min Stock) from `inventory.Product`. It also respects the `purchase_analysis_days` setting in the Organization configuration (default: 30 days).
- **SAVED**: This is a analytical logic; it does not persist data but provides insights to be used in Purchase Orders.

## User Interaction
- Inventory managers access these suggestions via the "Purchase Suggestions" view or when creating a new RFQ/PO.

## Step-by-Step Workflow
1. The manager requests reorder suggestions for the last X days (default 30).
2. The `InventoryService.get_purchase_suggestions` method is called.
3. The system calculates the average daily sales velocity for each active product by aggregating movements in the defined period.
4. The system calculates the "Target Stock" = (Daily Velocity * 14-day lead time) + Safety Stock (Min Stock Level).
5. If the `Current Stock` is less than the `Target Stock`, a suggestion is generated.
6. Suggestions are prioritized based on whether the current stock has already fallen below the safety threshold.
7. The list is returned to the UI, sorted by priority.

## How it achieves its goal
By automating the calculation of sales trends and lead-time demand, it prevents stockouts of fast-moving items and avoids overstocking slow-moving ones.
