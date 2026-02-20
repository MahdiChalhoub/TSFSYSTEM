# eCommerce Module — Documentation

## Goal
Register eCommerce as an independent, module-gated feature in the platform. Separate from client_portal while sharing its database tables via Django proxy models.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│  ecommerce      │────>│  client_portal   │
│  (proxy models) │     │  (real tables)   │
│                 │     │                  │
│ StorefrontConfig│     │ ClientPortalConfig│
│ Order           │     │ ClientOrder      │
│ OrderLine       │     │ ClientOrderLine  │
└─────────────────┘     └──────────────────┘
         │
         ▼
   Theme Engine  ←── ThemeRegistry (midnight, boutique)
   (frontend)        ThemeProvider ← ThemeLayout
```

## Data Flow
- **READ**: eCommerce views read from `client_portal` tables via proxy models
- **WRITE**: Orders/config written through proxy models — same underlying DB tables
- **Theme**: `StorefrontPublicConfigView` returns `storefront_theme` → PortalContext → ThemeProvider
- **Catalog**: `CatalogView` reads from `inventory.Product`

## Variables User Interacts With
- Module enable/disable toggle on Modules page
- Sidebar eCommerce section (gated by module code)

## Backend Files
| File | Purpose |
|------|---------|
| `manifest.json` | Module registration (code, name, deps) |
| `apps.py` | Django AppConfig |
| `models.py` | Proxy models (StorefrontConfig, Order, OrderLine) |
| `serializers.py` | DRF serializers |
| `views.py` | Catalog, themes, orders/stats, config viewsets |
| `urls.py` | URL routing (auto-discovered by kernel) |
| `admin.py` | Django admin registration |

## Frontend Files
| File | Purpose |
|------|---------|
| `src/modules/ecommerce/manifest.json` | Route definitions, permissions |
| `Sidebar.tsx` | eCommerce section with 4 links |

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ecommerce/catalog/?slug=X` | Public | Product catalog for storefront |
| GET | `/api/ecommerce/themes/` | Public | Available themes list |
| GET | `/api/ecommerce/orders/` | Admin | List eCommerce orders |
| GET | `/api/ecommerce/orders/stats/` | Admin | Order dashboard stats |
| GET | `/api/ecommerce/storefront-config/` | Admin | Storefront configuration |

## How It Integrates
1. **Auto-discovered** by Django: `settings.py` scans `apps/` for `apps.py`, `erp/urls.py` scans for `urls.py`
2. **Module sync** picks up `manifest.json` → creates `SystemModule` record
3. **Sidebar** shows eCommerce section when module is enabled (module gate: `ecommerce`)
4. **Zero migration risk**: Proxy models = no new DB tables
