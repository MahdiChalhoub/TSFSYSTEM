# Navigation Audit — Page Accessibility

## Goal
Ensure every page in the application is accessible from a button or link in the frontend UI.

## Pages & Navigation Map

### Admin Sidebar (`Sidebar.tsx`)
The admin sidebar is the primary navigation for privileged (back-office) pages.

#### Dashboard
| Page | Path | Sidebar Entry |
|------|------|---------------|
| Dashboard | `/dashboard` | Dashboard |

#### Commercial → Point of Sale
| Page | Path | Sidebar Entry |
|------|------|---------------|
| POS Terminal | `/sales` | POS Terminal |
| Order History | `/sales/history` | Order History |
| Sales Analytics | `/sales/analytics` | Sales Analytics |
| Quotations | `/sales/quotations` | Quotations |
| Deliveries | `/sales/deliveries` | Deliveries |
| Discount Rules | `/sales/discounts` | Discount Rules |
| Consignment | `/sales/consignment` | Consignment |
| Delivery Zones | `/sales/delivery-zones` | Delivery Zones |
| Sales Returns | `/sales/returns` | Sales Returns |
| Import Sales | `/sales/import` | Import Sales |

#### Commercial → Purchasing
| Page | Path | Sidebar Entry |
|------|------|---------------|
| Procurement Center | `/purchases` | Procurement Center |
| Purchase Dashboard | `/purchases/dashboard` | Purchase Dashboard |
| New RFQ / Order | `/purchases/new-order` | New RFQ / Order |
| Quick Purchase | `/purchases/new` | Quick Purchase |
| Purchase Returns | `/purchases/returns` | Purchase Returns |
| Supplier Sourcing | `/purchases/sourcing` | Supplier Sourcing |

#### Inventory
| Page | Path | Sidebar Entry |
|------|------|---------------|
| Product Master | `/products` | Products → Product Master |
| Product Analytics | `/inventory/analytics` | Products → Product Analytics |
| Combo & Bundles | `/inventory/combo` | Products → Combo & Bundles |
| Label Printing | `/inventory/labels` | Products → Label Printing |
| Warehouses | `/inventory/warehouses` | Warehousing → Warehouses & Zones |
| Stock Adjustments | `/inventory/adjustments` | Warehousing → Stock Adjustments |
| Global Inventory | `/inventory/global` | Warehousing → Global Inventory |
| Barcode Config | `/inventory/barcode` | Warehousing → Barcode Configuration |
| Expiry Alerts | `/inventory/expiry-alerts` | Warehousing → Expiry Alerts |
| Low Stock | `/inventory/low-stock` | Warehousing → Low Stock Alerts |
| Stock Movements | `/inventory/movements` | Warehousing → Stock Movements |
| Inventory Alerts | `/inventory/alerts` | Warehousing → Inventory Alerts |
| Serial Numbers | `/inventory/serials` | Warehousing → Serial Numbers |
| Stock Count | `/inventory/stock-count` | Warehousing → Stock Count |
| Adjustment Orders | `/inventory/adjustment-orders` | Stock Orders → Adjustment Orders |
| Transfer Orders | `/inventory/transfer-orders` | Stock Orders → Transfer Orders |
| Operational Requests | `/inventory/requests` | Stock Orders → Operational Requests |
| Stock Valuation | `/inventory/valuation` | Stock Orders → Stock Valuation |
| Categories | `/inventory/categories` | Catalog Setup → Categories |
| Categories Audit | `/inventory/categories/maintenance` | Catalog Setup → Categories Audit |
| Units | `/inventory/units` | Catalog Setup → Units & Packaging |
| Brands | `/inventory/brands` | Catalog Setup → Brands |
| Countries | `/inventory/countries` | Catalog Setup → Countries |
| Attributes | `/inventory/attributes` | Catalog Setup → Attributes |
| Maintenance | `/inventory/maintenance` | System Maintenance → Maintenance Dashboard |
| Data Quality | `/inventory/maintenance/data-quality` | System Maintenance → Data Quality |

#### Finance
All 45 finance pages are linked from the sidebar under Finance groups: Accounts & Ledger, Operations, Reports, Fiscal & Periods, Loans & Pricing, Events & Automation, and Financial Settings.

#### CRM
| Page | Path | Sidebar Entry |
|------|------|---------------|
| Contacts | `/crm/contacts` | Contact Center |
| Pricing | `/crm/pricing` | Client Pricing |
| Supplier Performance | `/crm/supplier-performance` | Supplier Performance |
| Insights | `/crm/insights` | Customer Insights |

#### HR & Teams
| Page | Path | Sidebar Entry |
|------|------|---------------|
| Employees | `/hr/employees` | Employee Manager |
| Departments | `/hr/departments` | Departments |
| Shifts | `/hr/shifts` | Shifts |
| Attendance | `/hr/attendance` | Attendance |
| Leaves | `/hr/leaves` | Leave Requests |
| Payroll | `/hr/payroll` | Payroll Summary |

#### SaaS Control (saas-only)
| Page | Path | Sidebar Entry |
|------|------|---------------|
| Organizations | `/organizations` | Organizations → Organizations |
| Registrations | `/organizations/registrations` | Organizations → Registrations |
| Switcher | `/switcher` | Organizations → Instance Switcher |
| Subscription Plans | `/subscription-plans` | Organizations → Subscription Plans |
| Health | `/health` | Infrastructure → Platform Health |
| Updates | `/updates` | Infrastructure → Kernel Updates |
| Modules | `/modules` | Infrastructure → Global Registry |
| Currencies | `/currencies` | Infrastructure → Currencies |
| Connector Control | `/connector` | Infrastructure → Connector → Connector Control |
| Connector Buffer | `/connector/buffer` | Infrastructure → Connector → Connector Buffer |
| Connector Logs | `/connector/logs` | Infrastructure → Connector → Connector Logs |
| Connector Policies | `/connector/policies` | Infrastructure → Connector → Connector Policies |
| MCP Dashboard | `/mcp` | Infrastructure → MCP AI → MCP Dashboard |
| MCP Chat | `/mcp/chat` | Infrastructure → MCP AI → MCP Chat |
| MCP Conversations | `/mcp/conversations` | Infrastructure → MCP AI → Conversations |
| MCP Providers | `/mcp/providers` | Infrastructure → MCP AI → Providers |
| MCP Tools | `/mcp/tools` | Infrastructure → MCP AI → Tools |
| MCP Usage | `/mcp/usage` | Infrastructure → MCP AI → Usage |
| MCP Settings | `/mcp/settings` | Infrastructure → MCP AI → MCP Settings |
| Encryption | `/encryption` | Infrastructure → AES-256 Encryption |

#### System Settings
| Page | Path | Sidebar Entry |
|------|------|---------------|
| Roles | `/settings/roles` | Roles & Permissions |
| Security | `/settings/security` | Security Settings |
| Notifications | `/settings/notifications` | Notifications |
| Subscription | `/subscription` | Billing & Subscription |

---

### Tenant Storefront (`StorefrontHeader.tsx`)
| Page | Path | Navigation |
|------|------|------------|
| Home / Products | `/tenant/[slug]` | Logo + "Products" link |
| Categories | `/tenant/[slug]/categories` | "Categories" link |
| Search | `/tenant/[slug]/search` | Search icon |
| Cart | `/tenant/[slug]/cart` | Cart icon |
| Quote | `/tenant/[slug]/quote` | "Quote" link (CATALOG_QUOTE mode) |
| Wishlist | `/tenant/[slug]/account/wishlist` | Heart icon (authenticated) |
| Notifications | `/tenant/[slug]/account/notifications` | Bell icon (authenticated) |
| Dashboard | `/tenant/[slug]/dashboard` | "Dashboard" link (authenticated) |
| Account | `/tenant/[slug]/account` | User avatar (authenticated) |
| Checkout | `/tenant/[slug]/checkout` | Reached from Cart page flow |

### Tenant Account Page
| Page | Path | Navigation |
|------|------|------------|
| Orders | `/tenant/[slug]/account/orders` | Account → Order History card |
| Wishlist | `/tenant/[slug]/account/wishlist` | Account → Wishlist card |
| Wallet | `/tenant/[slug]/account/wallet` | Account → Wallet & Loyalty card |
| Notifications | `/tenant/[slug]/account/notifications` | Account → Notifications card |
| Tickets | `/tenant/[slug]/account/tickets` | Account → Support card |
| Profile | `/tenant/[slug]/account/profile` | Account → Profile card (future stub) |

### Supplier Portal (Layout sidebar)
| Page | Path | Navigation |
|------|------|------------|
| Dashboard | `/supplier-portal/[slug]` | Dashboard link |
| Orders | `/supplier-portal/[slug]/orders` | Purchase Orders link |
| Proformas | `/supplier-portal/[slug]/proformas` | Proformas link |
| Price Requests | `/supplier-portal/[slug]/price-requests` | Price Requests link |
| Statement | `/supplier-portal/[slug]/statement` | Statement link |

## Data Flow
- **READ**: Navigation config is read from `MENU_ITEMS` array in `Sidebar.tsx` and nav arrays in `StorefrontHeader.tsx` / supplier portal `layout.tsx`
- **SAVE**: No data is saved; navigation is purely frontend routing

## Variables User Interacts With
- Sidebar expand/collapse toggles
- Mobile hamburger menu toggle
- Active tab highlighting

## Files Modified
- `src/components/admin/Sidebar.tsx` — Added 19 missing sidebar entries
- `src/components/tenant/StorefrontHeader.tsx` — Added Notifications bell, Dashboard link, mobile menu entries
