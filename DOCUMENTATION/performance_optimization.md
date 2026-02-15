# Page Load Performance Optimization

## Goal
Reduce page load times across the platform by eliminating redundant API calls, enabling response caching, removing production logging overhead, and providing instant visual feedback via loading skeletons.

## Changes Made

### 1. `React.cache()` on `getUser()` — `src/app/actions/auth.ts`
- **Problem**: `getUser()` was called in `(privileged)/layout.tsx` AND again in `(saas)/layout.tsx`, resulting in 2 identical API calls per page render.
- **Fix**: Wrapped `getUser()` with `React.cache()` so multiple calls within the same server request are deduplicated into 1 API call.

### 2. Removed Duplicate Font Import — `src/app/(privileged)/layout.tsx`
- **Problem**: `Outfit` font was imported in both root `layout.tsx` and `(privileged)/layout.tsx`, causing a duplicate Google Fonts request.
- **Fix**: Removed the second import. The font cascades from the root layout automatically.

### 3. Conditional Debug Logging — `src/lib/erp-api.ts`
- **Problem**: 15+ `console.log()` calls in the hot API path caused I/O overhead on every production request.
- **Fix**: Created a `debug()` helper that only logs when `NODE_ENV === 'development'`. All non-error logs replaced with this helper.

### 4. Smart Cache for GET Requests — `src/lib/erp-api.ts` + `src/lib/erp-fetch.ts`
- **Problem**: All fetch calls used `cache: 'no-store'`, so even identical GET requests within seconds would hit the Django backend.
- **Fix**: GET/HEAD requests now use `next: { revalidate: 30 }` (stale-while-revalidate pattern). POST/PUT/PATCH/DELETE remain as `cache: 'no-store'`. Callers can still override with explicit `cache: 'no-store'` where real-time data is essential.

### 5. Loading Skeletons — `src/app/(privileged)/loading.tsx` + `src/app/(privileged)/(saas)/dashboard/loading.tsx`
- **Problem**: Users saw a blank white screen while the server fetched data (3-5 API calls).
- **Fix**: Added `loading.tsx` files that Next.js shows automatically via React Suspense boundaries during server-side rendering. Skeletons match the actual page layout (sidebar + header + stats grid + content cards).

## Data Flow

### Before (per page load)
1. `getUser()` → API call to `auth/me/` (500ms)
2. Wait for result → if ok, `Promise.all([getSites(), getOrganizations(), getGlobalFinancialSettings()])` (3 parallel calls, 300-800ms each)
3. SaaS layout: `getUser()` → DUPLICATE API call to `auth/me/` (500ms)
4. Dashboard page: `getSaasStats()` → API call (300ms)
5. **Total: 5 API calls, 1300-1800ms+ server time**

### After
1. `getUser()` → API call to `auth/me/` (cached per-request with `React.cache()`)
2. `Promise.all([getSites(), getOrganizations(), getGlobalFinancialSettings()])` (cached for 30s via revalidate)
3. SaaS layout: `getUser()` → FREE (deduplicated by `React.cache()`)
4. Dashboard page: `getSaasStats()` → cached for 30s
5. Loading skeleton shown instantly during step 1-2
6. **Total: 4 unique API calls (often served from 30s cache), instant visual feedback**

## Files Modified
| File | Change |
|------|--------|
| `src/app/actions/auth.ts` | Added `React.cache()` around `getUser()` |
| `src/app/(privileged)/layout.tsx` | Removed duplicate `Outfit` font import |
| `src/lib/erp-api.ts` | Conditional debug logging + smart cache for GET |
| `src/lib/erp-fetch.ts` | Smart cache for GET requests |
| `src/app/(privileged)/loading.tsx` | **NEW** — Full-page loading skeleton |
| `src/app/(privileged)/(saas)/dashboard/loading.tsx` | **NEW** — Dashboard loading skeleton |
