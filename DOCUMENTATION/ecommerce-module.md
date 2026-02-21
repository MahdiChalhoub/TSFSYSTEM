# eCommerce Module — Documentation

## Goal
Independent eCommerce module that turns each organization into a **Shopify-like storefront**. Admins choose their **Store Type** (layout/behavior) and **Visual Theme** (colors/fonts).

## Architecture

```
┌─────────────────────────────┐     ┌──────────────────┐
│  ecommerce (module)         │────>│  client_portal   │
│  Proxy models + APIs        │     │  Real DB tables   │
│  /ecommerce/* admin pages   │     │  /workspace/*     │
│  Store Type + Theme system  │     │                   │
└─────────────────────────────┘     └──────────────────┘
```

## Store Types

| Type | Use Case | Homepage Layout | Checkout |
|------|----------|----------------|----------|
| **Product Store** | Retail e-commerce | Product grid, categories, featured | Cart → Checkout → Pay |
| **Catalogue** | Browse only / B2B quotes | Product grid, NO prices | "Request Quote" button |
| **Subscription** | SaaS / recurring services | Plans grid, feature comparison | Subscribe flow |
| **Landing Page** | Company website | Hero + About + Services + Contact | Contact form only |
## Storefront URL Aliases
The following aliases now work on any tenant subdomain (e.g. `pos.tsf.ci/`):
- `/` — Main Storefront
- `/store` — Alias for storefront
- `/home` — Alias for storefront

These are rewritten internally to `/tenant/[slug]`. All other routes (e.g. `/dashboard`, `/finance`) are passed through as regular application routes.

## Admin Theme Manager Page (`/ecommerce/themes`)
1. **Step 1 — Store Type Picker**: 5 selectable cards, instant save
2. **Step 2 — Visual Theme**: ThemeSelector (Midnight, Boutique, etc.)

## Data Model

### `ClientPortalConfig.storefront_type`
- **Type**: CharField(max_length=30)
- **Choices**: PRODUCT_STORE, CATALOGUE, SUBSCRIPTION, LANDING_PAGE, PORTFOLIO
- **Default**: PRODUCT_STORE
- **READ by**: StorefrontPublicConfigView, ecommerce serializers
- **WRITE by**: updatePortalConfig action, Admin

## Frontend Components

| Component | Path | Purpose |
|-----------|------|---------|
| `ThemedHomePage` | `src/app/tenant/[slug]/ThemedHomePage.tsx` | Routes to type-specific homepage |
| `LandingHomePage` | `src/storefront/components/LandingHomePage.tsx` | Hero + services + contact |
| `CatalogueHomePage` | `src/storefront/components/CatalogueHomePage.tsx` | Products without prices |
| `SubscriptionHomePage` | `src/storefront/components/SubscriptionHomePage.tsx` | Pricing plans grid |
| `PortfolioHomePage` | `src/storefront/components/PortfolioHomePage.tsx` | Project gallery |
| `StoreTypePicker` | `src/app/(privileged)/ecommerce/themes/StoreTypePicker.tsx` | Admin type selector |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/client-portal/storefront-config/?slug=X` | Public | Returns `storefront_type` + config |
| GET | `/api/ecommerce/themes/` | Public | Available visual themes |
| PATCH | `/api/client-portal/config/{id}/` | Admin | Update storefront_type / theme |

## Workflow
1. Admin → `/ecommerce/themes`
2. Picks Store Type (saves `storefront_type`)
3. Picks Visual Theme (saves `storefront_theme`)
4. Customer visits `/tenant/[slug]/`
5. `ThemedHomePage` reads `storefront_type` → renders correct layout
6. Visual theme colors/fonts applied via `useTheme()`
