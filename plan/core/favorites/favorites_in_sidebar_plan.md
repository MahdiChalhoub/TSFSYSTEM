# Implementation Plan - Favorites in Sidebar

The user wants to be able to add/remove pages from their Favorites section directly from the sidebar. Currently, favorites are managed from the Home page or the Favorites section itself, but not from the module menu items in the sidebar.

## Proposed Changes

### [Frontend] Sidebar Component

#### [MODIFY] [Sidebar.tsx](file:///root/.gemini/antigravity/scratch/TSFSYSTEM/src/components/admin/Sidebar.tsx)

1.  **Extract `useFavorites` values**: In the `Sidebar` component, destructure `toggleFavorite` and `isFavorite` from the `useFavorites()` hook.
2.  **Pass to `MenuItem`**: Update the `MenuItem` component signature to accept `isFavorite` and `toggleFavorite` props.
3.  **Update `MenuItem` UI**:
    *   Identify leaf nodes (items with a `path` but no `children`).
    *   Add a subtle star icon button to the right of the menu item title.
    *   Apply hover effects so the star only appears (or becomes more prominent) when the user hovers over the menu item.
    *   Bind the `onClick` event of the star to `toggleFavorite(item.title, item.path)`.
    *   Use `stopPropagation` on the star click to prevent triggering the navigation/expansion logic of the menu item itself.
    *   Style the star to match the existing Favorites design (filled primary color when active, outlined muted color otherwise).

## Verification Plan

### Manual Verification
1.  Open the sidebar.
2.  Hover over any module page (e.g., "Product Master").
3.  Click the star icon that appears.
4.  Verify that:
    *   The star fills with the primary color.
    *   The page appears in the "Favorites" section at the top of the sidebar.
    *   Clicking the star again removes it from favorites.
    *   Navigating to the page by clicking the title still works as expected.
