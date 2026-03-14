# Health & Encryption Pages - Theme Fix Documentation

## Goal
Fix the styling of the Health and Encryption pages so they match the platform's light theme used by the SaaS Dashboard.

## Problem
Both pages were using dark-themed Tailwind classes (`bg-slate-800/50`, `text-white`, `text-slate-500`) on a light-themed app (`bg-gray-50/50`, body `bg-slate-50`), making text and cards nearly invisible.

## Solution
Converted all dark theme classes to the light theme pattern used by `dashboard/page.tsx`:

| Dark (Before) | Light (After) |
|---|---|
| `bg-slate-800/50` | `bg-white` |
| `border-slate-700/50` | `border-gray-100` |
| `text-white` | `text-gray-900` |
| `text-slate-500` | `text-gray-500` |
| `text-slate-400` | `text-gray-400` |
| `bg-slate-900/50` | `bg-gray-50` |
| `bg-slate-700` | `bg-gray-100` |
| Cards: `rounded-lg` | `rounded-[2rem] shadow-xl` |

## Files Modified

### `src/app/(privileged)/(saas)/health/page.tsx`
- **Read from**: `health/` API endpoint
- **Saves to**: N/A (read-only monitoring page)
- **Variables**: `health` (HealthData), `loading`, `error`, `lastRefresh`
- **Workflow**: Fetches health data on mount, auto-refreshes every 30s, displays API status/database/latency/traffic

### `src/app/(privileged)/(saas)/encryption/page.tsx`
- **Read from**: `saas/modules/encryption/status/`, `organizations/`
- **Saves to**: `saas/modules/encryption/activate/`, `deactivate/`, `rotate-key/`
- **Variables**: `status` (EncryptionStatus), `orgs`, `selectedOrgId`, `actionLoading`, `error`, `success`, `showDemo`
- **Workflow**: Loads orgs + encryption status → user selects org → activate/deactivate/rotate key actions

## Theme Reference
All SaaS pages should follow the light theme pattern from `dashboard/page.tsx`:
- Card backgrounds: `bg-white border-gray-100 rounded-[2rem] shadow-xl`
- Text: `text-gray-900` (headings), `text-gray-500` (descriptions), `text-gray-400` (muted)
- Badges: `bg-{color}-50 text-{color}-600 border-{color}-200`
- Inputs: `bg-gray-50 border-gray-200 text-gray-900`
