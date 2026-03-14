# Storefront Theme Selector — Documentation

## Goal
Allow organization admins to switch between available storefront themes from the portal-config page. The selected theme is persisted per-org and applied to all tenant visitor pages.

## Data Flow

```
Admin Portal → ThemeSelector → updatePortalConfig(id, {storefront_theme}) → Django PATCH
                                                                                ↓
ClientPortalConfig.storefront_theme column (default: 'midnight')
                                                                                ↓
Tenant visits /tenant/[slug] → PortalContext.loadConfig → fetches storefront_theme
                                                                                ↓
ThemeLayout reads config.storefront_theme → passes to <ThemeProvider themeId={...}>
                                                                                ↓
ThemeRegistry lazy-loads the correct theme bundle → renders components
```

## Where Data is READ
- `ClientPortalConfig.storefront_theme` in Django model
- `StorefrontPublicConfigView` (GET `/api/client-portal/storefront/config/?slug=X`)
- `PortalContext.tsx` → `config` state
- `ThemeLayout.tsx` → reads `config.storefront_theme`

## Where Data is SAVED
- `updatePortalConfig` server action → PATCH `/api/client-portal/config/{id}/`
- Writes to `client_portal_config.storefront_theme` column

## Variables User Interacts With
- Theme card selection (click) on Portal Config page

## Step-by-Step Workflow
1. Admin navigates to **Workspace → Portal Configuration**
2. The page fetches the `ClientPortalConfig` (includes `storefront_theme`)
3. **ThemeSelector** renders visual cards for each theme in `THEME_CONFIGS`
4. Admin clicks a theme card → `updatePortalConfig` saves immediately
5. Success badge appears → Next time a customer visits the storefront, the new theme loads

## Files Modified

| File | Change |
|------|--------|
| `erp_backend/apps/client_portal/models.py` | Added `storefront_theme` CharField |
| `erp_backend/apps/client_portal/views.py` | Exposed in `StorefrontPublicConfigView` |
| `erp_backend/apps/client_portal/migrations/0004_...py` | Migration |
| `src/app/tenant/[slug]/ThemeLayout.tsx` | Reads config and passes theme to ThemeProvider |
| `src/app/(privileged)/workspace/portal-config/ThemeSelector.tsx` | [NEW] Visual theme cards |
| `src/app/(privileged)/workspace/portal-config/page.tsx` | Integrates ThemeSelector |
