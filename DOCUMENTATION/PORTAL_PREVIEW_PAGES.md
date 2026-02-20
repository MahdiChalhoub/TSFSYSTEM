# Portal Preview Pages

## Goal
Allow organization admins to preview exactly what their clients and suppliers see when visiting their portal, directly from the admin panel.

## Pages

### Client Gate Preview
- **URL**: `/workspace/client-gate-preview`
- **Embeds**: `/tenant/{org-slug}` (the client storefront)
- **Sidebar**: CRM → Client Gate → Gate Preview

### Supplier Gate Preview
- **URL**: `/workspace/supplier-gate-preview`
- **Embeds**: `/supplier-portal/{org-slug}` (the supplier portal)
- **Sidebar**: CRM → Supplier Gate → Gate Preview

## Features
- **Device Picker**: Desktop (full width) / Tablet (768px) / Mobile (375px)
- **Browser Chrome**: Traffic lights, URL bar, size indicator
- **Refresh**: Reload the iframe preview
- **Open Portal**: Opens the actual portal in a new tab
- **Live Preview**: Reflects real-time portal configuration changes

## Data Flow
- **Read**: `GET /api/organizations/` to determine the org slug
- **Display**: iframe embeds the actual portal route

## Files
- `src/components/workspace/PortalPreview.tsx` — Shared preview component
- `src/app/(privileged)/workspace/client-gate-preview/page.tsx` — Client preview page
- `src/app/(privileged)/workspace/supplier-gate-preview/page.tsx` — Supplier preview page
- `src/components/admin/Sidebar.tsx` — Gate Preview links (Eye icon)

## Workflow
1. Admin navigates to CRM → Client Gate → Gate Preview (or Supplier Gate → Gate Preview)
2. Page fetches org slug from the API
3. Iframe loads the portal at `/tenant/{slug}` or `/supplier-portal/{slug}`
4. Admin can switch between Desktop/Tablet/Mobile views
5. Admin can open the full portal in a new tab
