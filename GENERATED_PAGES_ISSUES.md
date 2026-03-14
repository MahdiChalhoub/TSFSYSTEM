# Generated Pages - Known Issues & Fixes

## Issue: Pages Show 404/500 Errors

### Root Cause
The generated pages immediately call backend APIs on load, but:
1. Some backend routes return 404 (not fully implemented)
2. Some backend routes return 500 (server errors)
3. Generated pages don't gracefully handle these errors

### Affected Routes
- `client-portal/shipping-rates/` → 404
- `inventory/brands/` → 500
- `inventory/categories/` → 500

### Why This Happens
Our generator creates pages that call:
```typescript
await erpFetch('module/route/')
```

But if the backend route isn't working, the page crashes.

### Solution Options

#### Option A: Fix Backend (Recommended)
Check why these routes return errors:
```bash
# Check Django logs
tail -f /var/log/nginx/error.log

# Check if ViewSet is properly implemented
# inventory/brands might have a database issue
```

#### Option B: Make Pages More Resilient
Update generated pages to handle errors gracefully:
```typescript
try {
  const data = await erpFetch('module/route/')
  setItems(Array.isArray(data) ? data : (data?.results || []))
} catch (error) {
  console.error('Failed to load:', error)
  // Show error message to user instead of crashing
  setError(error.message)
}
```

#### Option C: Lazy Load Data
Don't load data on page mount - wait for user action:
```typescript
// Only load when user clicks "Load Data" button
<Button onClick={loadData}>Load Data</Button>
```

### Immediate Fix

For now, the pages are generated and work IF the backend is healthy. The backend needs to:

1. **Fix `inventory/brands`** - Check why it returns 500
2. **Fix `inventory/categories`** - Check why it returns 500
3. **Implement `client-portal/shipping-rates`** - Or remove from router if not needed

### To Disable Problematic Pages

If you want to temporarily hide these pages:

```bash
# Remove the problematic client_portal pages
rm -rf src/app/\(privileged\)/client_portal/shipping-rates/

# Or just remove list page to prevent auto-load
rm src/app/\(privileged\)/client_portal/shipping-rates/page.tsx
```

The detail and create pages will still work if you navigate to them directly.

---

## File Import Issue (SQL File)

The file picker not responding is a separate issue - likely a frontend upload component problem, not related to the generated pages.

Check:
1. Browser console for JavaScript errors
2. File size limits (360MB is large - might timeout)
3. Upload endpoint configuration
