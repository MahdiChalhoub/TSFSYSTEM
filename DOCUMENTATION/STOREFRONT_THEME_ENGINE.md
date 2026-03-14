# Storefront Theme Engine

## Goal
Provide a themeable, developer-friendly storefront engine. Each tenant organization selects a theme, and the engine dynamically loads and renders the correct components.

## Architecture

```
src/storefront/
├── engine/          ← Core: types, hooks, ThemeProvider, ThemeRegistry
│   └── hooks/       ← useCart, useAuth, useConfig, useStore, useWishlist
└── themes/
    └── midnight/    ← Default dark theme (10 components)
```

## Data Flow

1. **Server** (`page.tsx`) — fetches products + org from Django API
2. **ThemeLayout** — wraps pages with ThemeProvider + active theme's Header/Footer
3. **ThemedHomePage** — resolves theme, renders theme's HomePage with server data
4. **Theme components** — use engine hooks (`useCart`, `useAuth`, etc.) for state

## Theme API Contract

Themes export components matching `ThemeComponents` interface:

| Component | Required | Purpose |
|-----------|----------|---------|
| HomePage | ✅ | Landing page with product catalog |
| ProductCard | ✅ | Individual product card |
| ProductDetail | ✅ | Product full page |
| Header | ✅ | Store navigation header |
| Footer | ✅ | Store footer |
| CartPage | ✅ | Shopping cart |
| CheckoutPage | ✅ | Order placement |
| LoginPage | ❌ | Customer sign-in |
| SearchPage | ❌ | Product search |
| CategoriesPage | ❌ | Category browser |

## Hooks Available to Themes

All hooks wrap `PortalContext` (single source of truth):

| Hook | Provides |
|------|----------|
| `useCart()` | cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal |
| `useAuth()` | user, isAuthenticated, login, logout |
| `useConfig()` | storeMode, orgName, orgLogo, slug, showPrice, isQuoteMode |
| `useStore()` | products, categories, searchProducts, getProductsByCategory |
| `useWishlist()` | wishlist, toggleWishlist, isInWishlist |

## Files

### Engine
- `src/storefront/engine/types.ts` — Theme API contract
- `src/storefront/engine/ThemeRegistry.ts` — Maps theme IDs → lazy-loaded modules
- `src/storefront/engine/ThemeProvider.tsx` — React context for active theme
- `src/storefront/engine/hooks/` — 5 hooks (useCart, useAuth, useConfig, useStore, useWishlist)
- `src/storefront/engine/index.ts` — Barrel export

### Midnight Theme
- `src/storefront/themes/midnight/` — 10 component files + theme.config.ts + index.ts

### Route Integration
- `src/app/tenant/[slug]/layout.tsx` — Wraps with PortalProvider + ThemeLayout
- `src/app/tenant/[slug]/ThemeLayout.tsx` — Loads theme Header/Footer
- `src/app/tenant/[slug]/ThemedHomePage.tsx` — Delegates to theme's HomePage
- `src/app/tenant/[slug]/page.tsx` — Server data fetch → ThemedHomePage

## Read From
- `client-portal/auth/login/` — Customer auth
- `products/storefront/` — Public product catalog
- `client-portal/storefront/config/` — Store mode + branding

## Write To
- `client-portal/my-orders/` — Order creation
- `client-portal/my-tickets/` — Support tickets
- `Organization.settings.storefront_theme` — Theme selection (Phase 4)

## Adding a New Theme

1. Create folder: `src/storefront/themes/<name>/`
2. Export components matching `ThemeComponents` from `index.ts`
3. Add config to `ThemeRegistry.THEME_CONFIGS`
4. Add dynamic import case to `ThemeRegistry.loadTheme()`
