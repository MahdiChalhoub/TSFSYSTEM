# Documentation: Country Detail & Hierarchy Page

## Goal
To visualize the product distribution and brand performance within a specific country.

## From where data is READ
- **Country Info**: Read from `countries/{id}/`.
- **Hierarchy Data**: Read from `countries/{id}/hierarchy/`. This returns a nested structure: Brand -> Category -> Products with stock levels.

## Where data is SAVED
- No data is saved on this page (Read-only view).

## Variables user interacts with
- `id`: The country ID from the URL.

## Step-by-step workflow
1. User clicks on a country from the inventory list.
2. System fetches country details and the full brand/product hierarchy.
3. Hierarchy is rendered as a tree.
4. User can expand/collapse brands to see categories and products.
5. Stock levels are displayed per product.

## How the page achieves its goal
By using a dedicated "hierarchy" endpoint on the backend, the page fetches complex relational data in a single optimized request, avoiding N+1 queries or client-side joining.
