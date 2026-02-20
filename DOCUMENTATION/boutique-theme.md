# Boutique Theme Documentation

## Goal
Provide a second theme for the storefront engine — "Boutique" — to prove multi-theme support.

## Design
- **Style**: Light, elegant, refined — targeting premium brands and curated shops
- **Colors**: Violet (#8b5cf6) primary, Pink (#ec4899) secondary, on white/violet-50 background
- **Typography**: Playfair Display (serif) for headings, DM Sans for body text
- **Aesthetic**: Soft gradients, rounded corners (2xl/3xl), subtle shadows, floating category badges

## Components

| Component | File | Purpose |
|-----------|------|---------|
| Header | `Header.tsx` | Gradient accent bar, serif logo, search/wishlist/cart icons, user dropdown |
| Footer | `Footer.tsx` | Dark indigo 4-column layout with shop/account/support links |
| HomePage | `HomePage.tsx` | Hero with gradient blobs, search, category pills, product grid |
| ProductCard | `ProductCard.tsx` | Rounded card with hover overlay, wishlist heart, low stock indicator |
| ProductDetail | `ProductDetail.tsx` | 2-column layout with trust badges, rating stars, quantity selector |
| CartPage | `CartPage.tsx` | White cards with quantity controls, elegant empty state |
| CheckoutPage | `CheckoutPage.tsx` | 2-column checkout with delivery form, payment picker, order summary |
| LoginPage | `LoginPage.tsx` | Centered card with gradient logo and violet-themed inputs |
| SearchPage | `SearchPage.tsx` | Search bar + sort dropdown + category pills + product grid |
| CategoriesPage | `CategoriesPage.tsx` | Collection cards that expand to show products |

## Data Flow
- **READ**: All data via shared engine hooks (`useStore`, `useCart`, `useAuth`, `useConfig`, `useWishlist`)
- **WRITE**: Cart actions via `useCart`, orders via Django API (checkout), auth via `useAuth`
- Themes **never** call APIs directly — only hooks

## Variables User Interacts With
- Search query (HomePage, SearchPage)
- Category filter (HomePage, CategoriesPage)
- Sort order (SearchPage)
- Cart quantity (CartPage, ProductDetail)
- Wishlist toggle (ProductCard, ProductDetail)
- Payment method (CheckoutPage)
- Delivery details form (CheckoutPage)

## How to Activate
Currently the theme is hardcoded to "midnight" in `ThemeProvider.tsx`. To test Boutique, change the `themeId` prop or the default in `ThemeProvider` to `"boutique"`. Phase 4 (admin theme selector) will make this configurable per organization.

## Workflow
1. ThemeProvider receives `themeId="boutique"`
2. ThemeRegistry lazy-loads `themes/boutique/index.ts`
3. Barrel export maps all 10 components to `ThemeComponents` interface
4. Route pages get Boutique components via `useTheme()`
5. Components render using shared hooks for data
