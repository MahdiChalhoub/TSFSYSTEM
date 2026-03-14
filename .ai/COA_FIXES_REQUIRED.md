# Chart of Accounts - Issues & Fixes Required

**URL**: https://saas.developos.shop/finance/chart-of-accounts
**Date**: 2026-03-13
**Status**: Multiple issues identified

---

## Issues Identified

### 1. ❌ Design Not Using Global Dynamic Design System
**Current**: Using mix of hardcoded Tailwind classes
**Required**: Use CSS variables (--app-*) from global design system
**Impact**: Inconsistent theming, doesn't adapt to user's theme selection

### 2. ❌ Chart Not Appearing / No Data Fetching
**Current**: Empty state shows even when accounts exist
**Possible Causes**:
- API endpoint `coa/coa/?scope=INTERNAL&include_inactive=false` not returning data
- Authentication/tenant context missing
- Error in data transformation (snake_case to camelCase)

### 3. ❌ Import COA Not Working
**Current**: No import button visible
**Required**: Add "Import from Template" button that triggers wizard

### 4. ❌ No Button to Open COA Wizard
**Current**: Wizard exists at `/finance/chart-of-accounts/templates` but no entry point
**Required**: Add prominent "Setup Wizard" or "Import Template" button on main page

### 5. ❌ Wizard Failed
**Current**: Template import action `importChartOfAccountsTemplate()` may be failing
**Possible Causes**:
- Backend endpoint `coa/apply_template/` not working
- Template data format mismatch
- Missing error handling

### 6. ❌ No Button to Migrate Between COA Templates
**Current**: Migration feature exists at `/finance/chart-of-accounts/migrate` but no button
**Required**: Add "Migrate to Different Template" button

### 7. ❌ Migration Failed
**Current**: Migration endpoint `coa/migrate/` may be failing
**Possible Causes**:
- Backend migration logic errors
- Balance transfer failing
- Account mapping validation issues

---

## Recommended Fixes

### Fix 1: Apply Global Dynamic Design System

**Replace hardcoded colors with CSS variables:**

```tsx
// ❌ Before
className="bg-emerald-50 text-emerald-600 border-emerald-100"

// ✅ After
className="bg-app-primary-light text-app-primary border-app-primary/30"
```

**All CSS variable mappings:**
- `bg-emerald-*` → `bg-app-primary*`
- `text-gray-*` → `text-app-muted-foreground`
- `border-stone-*` → `border-app-border`
- `bg-white` → `bg-app-surface`
- `text-black` → `text-app-foreground`

### Fix 2: Fix Data Fetching

**Debug steps:**
1. Check if `getChartOfAccounts()` returns empty array
2. Add error logging to server action
3. Verify backend API endpoint works:
   ```bash
   curl https://saas.developos.shop/api/coa/coa/?scope=INTERNAL
   ```
4. Check authentication cookies are being sent
5. Verify tenant context is set

**Proposed fix in `page.tsx`:**
```tsx
export default async function ChartOfAccountsPage() {
  const cookieStore = await cookies()
  const scope = (cookieStore.get('tsf_view_scope')?.value as 'OFFICIAL' | 'INTERNAL') || 'INTERNAL'

  let accounts: any = []
  let error: string | null = null

  try {
    accounts = await getChartOfAccounts(true, scope)
    console.log(`[COA] Fetched ${accounts.length} accounts`)
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
    console.error('[COA] Fetch error:', error)
  }

  return (
    <div className="page-container">
      {error && (
        <div className="bg-app-error-bg border border-app-error text-app-error p-4 rounded-lg mb-4">
          <strong>Error loading accounts:</strong> {error}
        </div>
      )}

      <ChartOfAccountsViewer accounts={accounts} />
    </div>
  )
}
```

### Fix 3: Add Import/Wizard Button

**Add to toolbar in `viewer.tsx`:**

```tsx
<div className="flex items-center gap-3">
  {/* NEW: Setup Wizard Button */}
  {accounts.length === 0 && (
    <button
      onClick={() => router.push('/finance/chart-of-accounts/templates')}
      className="flex items-center gap-2 text-sm bg-app-primary text-white px-4 py-2 rounded-lg hover:bg-app-primary/90 transition-all shadow-lg animate-pulse"
    >
      <Zap size={16} />
      Quick Setup Wizard
    </button>
  )}

  {/* Existing: Templates Library */}
  <button
    onClick={() => router.push('/finance/chart-of-accounts/templates')}
    className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-md hover:bg-app-surface transition-all shadow-sm"
  >
    <Library size={14} />
    Templates Library
  </button>

  {/* Existing: Templates Library */}
  {accounts.length > 0 && (
    <button
      onClick={() => router.push('/finance/chart-of-accounts/migrate')}
      className="flex items-center gap-2 text-xs font-bold text-app-warning hover:text-app-warning/80 border border-app-warning/30 px-3 py-1.5 rounded-md hover:bg-app-warning-bg transition-all shadow-sm"
    >
      <RefreshCcw size={14} />
      Migrate Template
    </button>
  )}

  {/* Rest of toolbar... */}
</div>
```

### Fix 4: Fix Wizard/Template Import

**Check backend endpoint exists:**
```bash
POST /api/coa/apply_template/
Body: {"template_key": "IFRS_COA", "reset": false}
```

**Add error handling in template viewer:**
```tsx
async function handleImport(templateKey: string) {
  try {
    setIsImporting(true)
    await importChartOfAccountsTemplate(templateKey as any)
    toast.success('Template imported successfully!')
    router.push('/finance/chart-of-accounts')
    router.refresh()
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e)
    toast.error(`Import failed: ${errorMsg}`)
    console.error('[COA_IMPORT]', e)
  } finally {
    setIsImporting(false)
  }
}
```

### Fix 5: Fix Migration Feature

**Check backend endpoint:**
```bash
POST /api/coa/migrate/
Body: {
  "mappings": [
    {"old_account_id": 123, "new_account_id": 456}
  ],
  "description": "Migration to IFRS"
}
```

**Add better error handling:**
```tsx
async function handleMigration(mappings: any[], description: string) {
  try {
    const result = await migrateBalances({ mappings, description })

    if (result.success) {
      toast.success(`Migration complete! ${result.accounts_migrated} accounts processed.`)
      router.push('/finance/chart-of-accounts')
    } else {
      toast.error(result.error || 'Migration failed')
    }
  } catch (e) {
    toast.error(`Migration error: ${e.message}`)
    console.error('[COA_MIGRATION]', e)
  }
}
```

---

## Backend API Endpoints to Verify

### 1. Get Chart of Accounts
```
GET /api/coa/coa/?scope=INTERNAL&include_inactive=false
Response: [
  {
    "id": 1,
    "code": "1000",
    "name": "Assets",
    "type": "ASSET",
    "parent_id": null,
    "rollup_balance": "150000.00",
    ...
  }
]
```

### 2. Create Account
```
POST /api/coa/
Body: {
  "code": "1010",
  "name": "Cash",
  "type": "ASSET",
  "parent": null
}
```

### 3. Apply Template
```
POST /api/coa/apply_template/
Body: {
  "template_key": "IFRS_COA",
  "reset": false
}
```

### 4. Migrate Accounts
```
POST /api/coa/migrate/
Body: {
  "mappings": [...],
  "description": "Migration description"
}
```

---

## Testing Checklist

### Manual Tests Required:

1. **Data Fetching**
   - [ ] Open `/finance/chart-of-accounts`
   - [ ] Verify accounts load (not empty)
   - [ ] Check browser console for errors
   - [ ] Check Network tab for API calls

2. **Create New Account**
   - [ ] Click "New Account" button
   - [ ] Fill in form
   - [ ] Submit
   - [ ] Verify account appears in tree

3. **Template Import**
   - [ ] Click "Templates Library" button
   - [ ] Select a template (e.g., IFRS)
   - [ ] Click "Import"
   - [ ] Verify accounts are created
   - [ ] Check for errors in console

4. **Migration**
   - [ ] Click "Migrate Template" button
   - [ ] Select target template
   - [ ] Map old accounts to new
   - [ ] Execute migration
   - [ ] Verify balances transferred

5. **Design System**
   - [ ] Switch theme (if theme switcher exists)
   - [ ] Verify colors adapt to theme
   - [ ] Check all buttons use CSS variables
   - [ ] Verify responsive design works

---

## Priority Fixes (Immediate)

1. **HIGH**: Fix data fetching - accounts not showing
2. **HIGH**: Add "Setup Wizard" button for empty state
3. **MEDIUM**: Apply global design system CSS variables
4. **MEDIUM**: Add "Migrate" button to toolbar
5. **LOW**: Improve error messages and logging

---

## Implementation Steps

### Step 1: Fix Data Fetching (30 min)
1. Add logging to `getChartOfAccounts()`
2. Test API endpoint directly
3. Fix any authentication issues
4. Verify data transformation works

### Step 2: Apply Design System (45 min)
1. Replace all hardcoded colors with CSS variables
2. Test with different themes
3. Verify all states (hover, active, disabled)

### Step 3: Add Missing Buttons (15 min)
1. Add "Quick Setup Wizard" button (empty state)
2. Add "Migrate Template" button (existing accounts)
3. Position properly in toolbar

### Step 4: Fix Wizard (30 min)
1. Test template import endpoint
2. Add error handling
3. Add loading states
4. Test all templates

### Step 5: Fix Migration (45 min)
1. Test migration endpoint
2. Fix mapping UI
3. Add validation
4. Test balance transfer

### Total Estimated Time: 3 hours

---

## Files to Modify

1. `src/app/(privileged)/finance/chart-of-accounts/page.tsx` - Add error handling
2. `src/app/(privileged)/finance/chart-of-accounts/viewer.tsx` - Add buttons, apply design system
3. `src/app/(privileged)/finance/chart-of-accounts/templates/viewer.tsx` - Fix import errors
4. `src/app/(privileged)/finance/chart-of-accounts/migrate/viewer.tsx` - Fix migration errors
5. `src/app/actions/finance/accounts.ts` - Add logging, fix API calls
6. `src/app/actions/finance/coa-templates.ts` - Fix import/migration actions

---

## Next Steps

1. **Verify backend API endpoints work** (use curl/Postman)
2. **Add comprehensive logging** to all server actions
3. **Test each feature** with real data
4. **Apply design system** consistently
5. **Document any backend fixes needed**

---

**Status**: Documentation complete, ready for implementation
**Estimated Effort**: 3 hours for complete fix
**Priority**: HIGH (core finance feature not working)
