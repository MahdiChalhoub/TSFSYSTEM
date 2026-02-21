# eCommerce Module — Documentation

## Goal
Independent eCommerce module for managing the storefront. Separate from Client Gate (CRM) with its own dedicated pages and sidebar section.

## Architecture

```
┌─────────────────────────┐     ┌──────────────────┐
│  ecommerce (module)     │────>│  client_portal   │
│  Proxy models + APIs    │     │  Real DB tables   │
│  Dedicated /ecommerce/* │     │  /workspace/*     │
│  pages                  │     │  pages            │
└─────────────────────────┘     └──────────────────┘
```

## eCommerce vs Client Gate Routes

| eCommerce Module | Client Gate (CRM) |
|------------------|-------------------|
| `/ecommerce/dashboard` — Storefront Overview | `/workspace/portal-config` — Portal Config |
| `/ecommerce/settings` — Store Mode, Branding, Toggles | `/workspace/client-access` — Client Access |
| `/ecommerce/themes` — Theme Manager | `/workspace/client-orders` — Order Admin |
| `/ecommerce/orders` — Online Orders | `/workspace/client-tickets` — Ticket Admin |
| `/ecommerce/catalog` — Product Catalog | — |

## Sidebar Entry (module-gated: `ecommerce`)
- Storefront Overview (`/ecommerce/dashboard`)
- Storefront Settings (`/ecommerce/settings`)
- Theme Manager (`/ecommerce/themes`)
- Online Orders (`/ecommerce/orders`)
- Product Catalog (`/ecommerce/catalog`)

## Backend API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ecommerce/catalog/?slug=X` | Public | Product catalog |
| GET | `/api/ecommerce/themes/` | Public | Available themes |
| GET | `/api/ecommerce/orders/` | Admin | List orders |
| GET | `/api/ecommerce/orders/stats/` | Admin | Order stats |

## Data
- **READ**: Proxy models from `client_portal` tables
- **WRITE**: Same tables via proxy models
- **No migration needed**: Zero new DB tables

## Pages
| Page | Type | Key Features |
|------|------|-------------|
| Dashboard | Client | Stats cards, analytics placeholder |
| Settings | Server + Client | Store mode selector, branding, feature toggles |
| Themes | Server | Reuses ThemeSelector from portal-config |
| Orders | Client | Status filter pills, order table |
| Catalog | Client | Product grid, search |
