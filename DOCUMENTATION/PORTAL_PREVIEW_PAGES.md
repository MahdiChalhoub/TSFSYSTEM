# Portal Preview Pages

## Goal
Allow organization admins to preview exactly what their clients and suppliers see, without leaving the admin panel or needing portal access.

## Pages

### Client Gate Preview
- **URL**: `/crm/client-gate-preview`
- **Sidebar**: CRM → Client Gate → Gate Preview
- **Features**: 
  - Type selector (Retail / Wholesale / Consignee)
  - Product catalog with simulated pricing per type
  - Search products
  - No login/access required — pure preview

### Supplier Gate Preview
- **URL**: `/crm/supplier-gate-preview`
- **Sidebar**: CRM → Supplier Gate → Gate Preview
- **Features**:
  - Supplier picker (searchable dropdown)
  - PO dashboard for selected supplier (status badges, stats)
  - Shows real purchase order data

## Data Flow
- **Client Preview**: Reads products from `GET /api/products/?is_active=true`, org from `GET /api/organizations/`
- **Supplier Preview**: Reads suppliers from `GET /api/contacts/?type=SUPPLIER`, POs from `GET /api/purchase-orders/?supplier={id}`

## Files
- `src/app/(privileged)/crm/client-gate-preview/client.tsx` — Client preview component
- `src/app/(privileged)/crm/client-gate-preview/page.tsx` — Client preview page
- `src/app/(privileged)/crm/supplier-gate-preview/client.tsx` — Supplier preview component
- `src/app/(privileged)/crm/supplier-gate-preview/page.tsx` — Supplier preview page
- `src/components/admin/Sidebar.tsx` — Gate Preview links (Eye icon)

## Workflow
1. Admin navigates to CRM → Client Gate → Gate Preview (or Supplier Gate)
2. **Client**: Selects client type (Retail/Wholesale/Consignee) — sees pricing differences
3. **Supplier**: Selects a supplier — sees their PO dashboard
