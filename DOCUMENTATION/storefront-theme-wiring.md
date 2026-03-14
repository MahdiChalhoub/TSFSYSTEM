# Storefront Theme Engine — Page Wiring Documentation

## Goal
Wire all tenant-facing storefront pages to the theme engine so they render using the active theme's components (currently "Midnight").

## Architecture

### Engine Layer (`src/storefront/engine/`)
- **types.ts** — API contract: `ThemeConfig`, `ThemeComponents`, hook return types
- **ThemeRegistry.ts** — Maps theme IDs → configs + lazy-loads theme modules
- **ThemeProvider.tsx** — React context provider, exposes `useTheme()` hook
- **hooks/** — Shared hooks: `useCart`, `useAuth`, `useConfig`, `useStore`, `useWishlist`
- **index.ts** — Barrel export

### Theme Layer (`src/storefront/themes/midnight/`)
- All 10 components: `Header`, `Footer`, `HomePage`, `ProductCard`, `ProductDetail`, `CartPage`, `CheckoutPage`, `LoginPage`, `SearchPage`, `CategoriesPage`
- `theme.config.ts` — Colors, fonts, metadata
- `index.ts` — Maps components to `ThemeComponents` interface

### Route Layer (`src/app/tenant/[slug]/`)
Each page is a thin wrapper that delegates to the active theme:

| Route | File | Theme Component | Data Source |
|-------|------|----------------|-------------|
| `/tenant/[slug]` | `page.tsx` → `ThemedHomePage.tsx` | `HomePage` | Server-fetched products |
| `/tenant/[slug]/cart` | `cart/page.tsx` | `CartPage` | `useCart` hook |
| `/tenant/[slug]/checkout` | `checkout/page.tsx` | `CheckoutPage` | `useCart` hook |
| `/tenant/[slug]/search` | `search/page.tsx` | `SearchPage` | `useStore` hook |
| `/tenant/[slug]/categories` | `categories/page.tsx` | `CategoriesPage` | `useStore` hook |
| `/tenant/[slug]/product/[id]` | `product/[id]/page.tsx` | `ProductDetail` | Route-level fetch |
| `/tenant/[slug]/register` | `register/page.tsx` | *(standalone)* | Direct API call |

## Data Flow

### Where Data Is READ
- **Products**: `useStore` hook → `NEXT_PUBLIC_DJANGO_URL/api/products/public/?organization_slug=...`
- **Cart**: `useCart` hook → `PortalContext.cart` (local state managed by context)
- **Auth**: `useAuth` hook → `PortalContext.currentUser`
- **Config**: `useConfig` hook → `PortalContext.config` (org settings, store mode, etc.)
- **Product Detail**: Fetched at route level → `NEXT_PUBLIC_DJANGO_URL/api/products/storefront/[id]/?organization_slug=...`

### Where Data Is SAVED
- **Cart actions**: `PortalContext.addToCart()`, `removeFromCart()`, `updateQuantity()`
- **Orders**: `CheckoutPage` → `NEXT_PUBLIC_DJANGO_URL/api/orders/` (POST)
- **Auth**: `LoginPage` → `NEXT_PUBLIC_DJANGO_URL/api/auth/portal-login/` (POST)

## Variables User Interacts With
- **Theme selection**: Currently hardcoded to "midnight" (future: DB-driven per organization)
- **Cart quantity**: Adjustable in CartPage via +/- buttons
- **Search query**: Text input in SearchPage
- **Category filter**: Click category in CategoriesPage
- **Product selection**: Click product card → ProductDetail page

## Workflow
1. User visits `/tenant/[slug]`
2. `layout.tsx` wraps with `PortalProvider` → `ThemeLayout`
3. `ThemeLayout` loads `ThemeProvider("midnight")` → renders Header + Footer
4. Page component calls `useTheme()` → gets active theme's component
5. Theme component uses shared hooks (`useCart`, `useStore`, etc.) for data
6. Hooks read from `PortalContext` which manages state + API calls

## How Pages Achieve Their Goals

### Cart Page
Renders theme's `CartPage` component. Component uses `useCart()` to display items, update quantities, and calculate totals. "Proceed to Checkout" navigates to `/tenant/[slug]/checkout`.

### Checkout Page
Renders theme's `CheckoutPage`. Uses `useCart()` for items + `useAuth()` for customer info. Collects delivery details and payment method, then POSTs order to Django API.

### Search Page
Renders theme's `SearchPage`. Uses `useStore()` to get all products + `searchProducts()` function. Filters results client-side as user types.

### Categories Page
Renders theme's `CategoriesPage`. Uses `useStore()` to get categories (derived from product data) + `getProductsByCategory()` to filter when a category is selected.

### Product Detail Page
Route-level fetch of product data from Django API, then passes product object to theme's `ProductDetail` component. Uses `useCart()` and `useWishlist()` for add-to-cart/wishlist buttons.
