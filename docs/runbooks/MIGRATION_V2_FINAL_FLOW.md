# Migration v2.0 - Final Simplified Flow

## 🎯 Understanding Clarified

The user clarified:
> "SELCT HTE ORGANISAION FORM SOURCE OF DATA IS JUST FOR FILTIRING"

This means:
- **Organization selection** = Selecting which **business** from the SQL file to import
- **Target organization** = Automatically use the **current logged-in organization**
- No need for a separate target organization selection step!

## ✅ Final Flow

```
1. REVIEW_SCOPE
   ↓ User confirms scope (FULL, PRODUCTS, etc.) and source (ULTIMATE_POS, etc.)

2. SELECT_DATA_SOURCE
   ↓ User picks file from Cloud Storage or uploads from PC
   ↓ Stores file reference

3. SELECT_BUSINESS (when backend is ready)
   ↓ Backend parses SQL and extracts businesses
   ↓ User selects SOURCE business (for filtering)
   ↓ Auto-creates job with CURRENT org as target
   ↓ Toast: "Business Name → Your Organization"

4. VALIDATE
   ↓ Check COA and posting rules

5. MASTER_DATA
   ↓ Import categories, brands, units

6. ENTITIES
   ↓ Import customers, suppliers, products

7. COMPLETE
   ↓ Show summary
```

## 🔄 What Changed

### 1. Removed Organization Selection Step

**Before**: Had a separate step to select target organization
**After**: Auto-uses current logged-in organization

```typescript
// ❌ Old: Ask user to select target org
setCurrentStep('SELECT_ORG');

// ✅ New: Auto-use current org and skip to validation
const newJob = await createMigrationJob({
    name: `${business.name} → ${user.organization_name}`,
    target_organization_id: user.organization_id, // From session!
    coa_template: 'SYSCOHADA',
});
setCurrentStep('VALIDATE');
```

### 2. Business Selection = Filtering

The "SELECT_BUSINESS" step is for choosing which business FROM the SQL file:
- **Example**: SQL contains "Main Store" and "Branch Store"
- User selects "Main Store" → filters data to import only that business
- Target is ALWAYS the current organization

### 3. Cloud File Handler Simplified

```typescript
async function handleSelectCloudFile(file: any) {
    setSelectedCloudFile(file);
    setUploadedFileId(file.uuid);

    // Get current user's organization (auto-select as target)
    if (!user || !user.organization_id) {
        throw new Error('Please log in to continue');
    }

    // Create job immediately with current org as target
    const newJob = await createMigrationJob({
        name: `${SCOPE_INFO[scopeParam].label} from ${SOURCE_INFO[sourceParam].label}`,
        target_organization_id: user.organization_id, // ✅ From session
        coa_template: 'SYSCOHADA',
    });

    setJob(newJob);
    toast.success(`Target: ${user.organization_name}`);
    setCurrentStep('VALIDATE'); // Skip to validation
}
```

### 4. Added Debug Logging

```typescript
// Debug logging to see user state
useEffect(() => {
    console.log('🔍 User loading state:', { userLoading, user });
}, [userLoading, user]);
```

Check browser console to see if user is loading properly.

## 🐛 Troubleshooting

### If User is Not Loading

Check browser console for:
```
🔍 User loading state: { userLoading: false, user: null }
```

If `user` is `null` after loading completes, it means:
1. Not logged in
2. Auth token expired
3. `auth/me/` API call failed

**Solution**: Log out and log back in.

### If "Please log in to continue" Error

This means `user.organization_id` is missing. Check:
1. Browser console for user object
2. Network tab for `/api/auth/me/` response
3. Cookie for `auth_token`

## 📋 Files Changed

**File**: [src/app/(privileged)/migration_v2/jobs/new/page.tsx](src/app/(privileged)/migration_v2/jobs/new/page.tsx)

### Changes:
1. **Line 93-96**: Added debug logging for user state
2. **Line 202-230**: Updated `handleSelectBusiness` to create job immediately
3. **Line 251-285**: Updated `handleSelectCloudFile` to create job immediately
4. **Line 505**: Removed entire SELECT_ORG step UI
5. **Line 134-156**: Simplified `loadOrganizations` (though it's no longer called)

## 🎯 Simplified Concept

```
SOURCE (SQL file)                TARGET (Current Org)
─────────────────                ────────────────────
"Main Store"                     "Demo Company"
  ├─ 9000 products         →       (your logged-in org)
  ├─ 500 contacts
  └─ 2000 transactions

User selects:
  ✅ Which business FROM source (for filtering)
  ❌ NOT selecting target - it's automatic!
```

## 🧪 Test Flow

1. Make sure you're logged in to TSFSYSTEM
2. Open browser console (F12)
3. Navigate to `/migration_v2/jobs/new?scope=FULL&source=ULTIMATE_POS`
4. Check console for: `🔍 User loading state: { userLoading: false, user: {...} }`
5. If user is loaded, you should see `organization_id` and `organization_name`
6. Click "Confirm" → "Pick from Cloud Storage"
7. Click a .sql file
8. Should create job and skip to VALIDATE step
9. Toast should show: "Target: Your Organization Name"

## ✅ Status

- ✅ Organization selection removed
- ✅ Auto-uses current org as target
- ✅ Business selection = filtering source data
- ✅ TypeScript checks pass
- ✅ Debug logging added
- ⏳ Awaiting user test

## 🔍 Next Steps

If you still see "No organization found" error:

1. **Check console** for the debug log
2. **Share the console output** so we can see what's in the user object
3. **Try logging out and back in** to refresh session

The error now means the user object itself is not loading, not that the API call failed.

---

**Updated**: 2026-03-08
**Status**: ✅ Simplified flow complete
**Issue**: Organization selection misunderstood as target selection
**Solution**: Removed target selection, auto-use current org, business selection = filtering
