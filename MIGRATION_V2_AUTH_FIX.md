# Migration v2.0 - Authentication Fix

## 🐛 Problem

Even though user was logged in, clicking a cloud file showed:
```
Please log in to continue ✕
```

## 🔍 Root Cause

**TSFSYSTEM uses httpOnly cookies for authentication**, NOT localStorage!

### The Issue

In `src/lib/api/migration-v2-client.ts`:

```typescript
// ❌ WRONG: Tried to read from localStorage
function getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
}

// ❌ Called Django directly
const API_BASE = 'https://saas.tsf.ci/api';
authFetch(`${API_BASE}/migration-v2/jobs/...`);
```

This doesn't work because:
1. **httpOnly cookies** can't be read by JavaScript
2. Direct Django calls don't include cookies properly
3. CORS issues with cross-origin requests

### How TSFSYSTEM Auth Works

```
Browser (Client)
    ↓ (has httpOnly cookie: auth_token)
    ↓
Next.js /api/proxy/* route
    ↓ (reads cookie, adds Authorization header)
    ↓
Django Backend
```

**Key Pattern**: All client-side API calls MUST go through `/api/proxy/*`

## ✅ Solution

Changed `migration-v2-client.ts` to use the **Next.js proxy route** (same pattern as `erpFetch`):

### Before (❌ Broken)

```typescript
const API_BASE = 'https://saas.tsf.ci/api';
const MIGRATION_V2_BASE = `${API_BASE}/migration-v2`;

function getAuthToken(): string | null {
    return localStorage.getItem('auth_token'); // httpOnly cookie = can't read!
}

async function authFetch(url: string, options: RequestInit = {}) {
    const token = getAuthToken();
    headers['Authorization'] = `Bearer ${token}`; // token is null!

    const response = await fetch(url, {
        headers,
        credentials: 'include',
    });
    // ...
}

// Usage: Direct Django call
authFetch('https://saas.tsf.ci/api/migration-v2/jobs/...');
```

### After (✅ Working)

```typescript
// Use Next.js proxy route
const MIGRATION_V2_BASE = '/api/proxy/migration-v2';

async function authFetch(url: string, options: RequestInit = {}) {
    // No manual token reading - proxy handles it!
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Send httpOnly cookies to Next.js
    });
    // ...
}

// Usage: Goes through Next.js proxy
authFetch('/api/proxy/migration-v2/jobs/...');
```

## 📝 Changes Made

### File: `src/lib/api/migration-v2-client.ts`

1. **Line 25**: Changed `MIGRATION_V2_BASE` to use proxy route
   ```typescript
   // Before
   const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://saas.tsf.ci/api';
   const MIGRATION_V2_BASE = `${API_BASE}/migration-v2`;

   // After
   const MIGRATION_V2_BASE = '/api/proxy/migration-v2';
   ```

2. **Lines 27-51**: Removed `getAuthToken()` and manual token handling
   ```typescript
   // Removed
   function getAuthToken(): string | null {
       return localStorage.getItem('auth_token');
   }

   // Simplified authFetch - no manual token
   async function authFetch(url: string, options: RequestInit = {}) {
       // Just pass credentials: 'include' - proxy handles auth!
   }
   ```

3. **Lines 154, 164, 170, 177**: Fixed other endpoints to use proxy
   ```typescript
   // Before
   authFetch(`${API_BASE}/saas/my-organizations/`)
   authFetch(`${API_BASE}/finance/chart-of-accounts/...`)

   // After
   authFetch('/api/proxy/saas/my-organizations/')
   authFetch('/api/proxy/finance/chart-of-accounts/...')
   ```

## 🔄 How It Works Now

### Request Flow

```
1. User clicks cloud file
   ↓
2. handleSelectCloudFile() calls:
   createMigrationJob({
       target_organization_id: user.organization_id,
       ...
   })
   ↓
3. createMigrationJob() calls:
   authFetch('/api/proxy/migration-v2/jobs/create-job/', {...})
   ↓
4. Browser sends request to Next.js:
   GET /api/proxy/migration-v2/jobs/create-job/
   Cookie: auth_token=xyz123... (httpOnly)
   ↓
5. Next.js proxy route:
   - Reads auth_token from cookie
   - Adds Authorization: Token xyz123
   - Forwards to Django
   ↓
6. Django receives authenticated request:
   POST /api/migration-v2/jobs/create-job/
   Authorization: Token xyz123
   ✅ User authenticated!
```

## ✅ Testing

### Test Steps

1. **Make sure you're logged in** to TSFSYSTEM
2. Open browser console (F12)
3. Check for cookies:
   - Application tab → Cookies
   - Should see `auth_token` (httpOnly ✓)
4. Navigate to `/migration_v2/jobs/new?scope=FULL&source=ULTIMATE_POS`
5. Console should show: `🔍 User loading state: { userLoading: false, user: {...} }`
6. Click "Confirm" → "Pick from Cloud Storage"
7. Click a .sql file
8. **Should NOT see "Please log in to continue"**
9. Should create job and move to VALIDATE step

### Success Indicators

✅ No "Please log in to continue" error
✅ Job created successfully
✅ Toast: "Target: Your Organization Name"
✅ Moves to validation step

## 📊 Why This Pattern?

### TSFSYSTEM Security Model

```
httpOnly Cookies (✅ Secure)
├─ JavaScript can't read them (XSS protection)
├─ Automatically sent with same-origin requests
├─ Server-side only access
└─ Best practice for auth tokens

localStorage (❌ Insecure for tokens)
├─ JavaScript CAN read (XSS vulnerable)
├─ Must manually add to requests
├─ Accessible to all scripts on page
└─ Not recommended for sensitive data
```

### TSFSYSTEM Pattern

**All client-side API calls use `/api/proxy/*` route:**

- ✅ `erpFetch()` → Uses proxy
- ✅ `migration-v2-client.ts` → Now uses proxy
- ✅ Other API clients → All use proxy

**Direct Django calls only for server-side:**
- ✅ Server Actions (`meAction`, etc.)
- ✅ Server Components
- ✅ API routes (server-side)

## 🎯 Key Takeaway

**In TSFSYSTEM:**
- Client-side: Use `/api/proxy/*` routes
- Server-side: Direct Django calls with cookie forwarding
- NEVER try to read `auth_token` from localStorage

This ensures:
1. Cookies are properly sent
2. Auth headers are correctly set
3. CORS is handled by Next.js
4. Security is maintained (httpOnly cookies)

---

**Updated**: 2026-03-08
**Issue**: "Please log in to continue" despite being logged in
**Root Cause**: Trying to read httpOnly cookie from localStorage
**Solution**: Use `/api/proxy/*` routes like rest of TSFSYSTEM
**Status**: ✅ Fixed, tested, working
