# Phase 6 — Critical Auth & Dashboard Fixes

## Goal
Address critical UX audit items #1, #2, #3, #6 and clean up remaining jargon in auth pages.

## Data Read
- Business registration page (`register/business/page.tsx`)
- Login page (`login/page.tsx`)
- Dashboard page (`dashboard/page.tsx`)

## Data Saved
- Updated registration page headings (4 jargon → plain text)
- Updated login 2FA label (1 jargon → plain text)

## Variables User Interacts With
- Registration step headings (visible during business setup)
- 2FA verification code label (visible during login)

## Verification Results

### Items Already Fixed in Prior Sessions
| # | Issue | Status |
|---|-------|--------|
| 1 | Password in hidden 2FA field | ✅ Now uses `challenge_id` |
| 2 | No step validation | ✅ Full validation on Steps 1 & 2 |
| 3 | No confirm password | ✅ Field present with match check |
| 6 | Dashboard XOF hardcode | ✅ Fetches `currency_code` from org settings |

### New Changes
| File | Old Text | New Text |
|------|----------|----------|
| `register/business/page.tsx` | "Strategic Infrastructure Genesis" | "New Business Setup" |
| `register/business/page.tsx` | "Master Authorization" | "Admin Account" |
| `register/business/page.tsx` | "Operational Identity" | "Business Details" |
| `register/business/page.tsx` | "Infrastructure & Intel" | "Location & Contact" |
| `login/page.tsx` | "Security Token" | "Verification Code" |

## How This Achieves Its Goal
Ensures auth pages use plain, professional language that any business user can understand without confusion.
