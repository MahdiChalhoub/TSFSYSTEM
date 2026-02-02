# Documentation: Category Maintenance Page

## Goal
To reorganize products by moving them between categories in a streamlined interface.

## From where data is READ
- **Categories**: Read from `categories/with_counts/` (Django API) via `getCategoryWithCounts`.
- **Products**: Read from `products/?category={id}` (Django API) via `erpFetch`.

## Where data is SAVED
- **Product Categories**: Updated via `categories/move_products/` (Django API) which accepts `productIds` and `targetCategoryId`.

## Variables user interacts with
- `activeCategoryId`: The ID of the currently selected category in the sidebar.
- `targetCategoryId`: Selected in the reassignment table to move products.
- `selectedProducts`: Array of product IDs to be moved.

## Step-by-step workflow
1. User navigates to Category Maintenance.
2. Sidebar displays all categories with their current product counts.
3. User selects a category.
4. System fetches all products belonging to that category.
5. User selects one or more products in the table.
6. User selects a target category for the move.
7. User confirms the move.
8. Frontend calls `moveProducts` action, which hits the backend `move_products` endpoint.
9. Backend updates products in an atomic transaction and returns success.
10. Page revalidates and UI updates with new counts.

## How the page achieves its goal
By utilizing a dual-pane layout (sidebar for navigation, table for action) and leveraging backend atomic updates, the page ensures efficient reorganization without data desynchronization.
