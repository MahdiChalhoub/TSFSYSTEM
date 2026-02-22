# TSF System Feature Registry

This document serves as the "Source of Truth" for critical features. If a path changes or logic is refactored, this registry must be updated and verified.

## 1. Finance & Accounting
| Feature | Path | Critical Logic |
| :--- | :--- | :--- |
| **Ledger (2 Tabs)** | `src/app/(privileged)/finance/(transactions)/ledger/page.tsx` | Tab switching logic between "MANUAL" and "AUTO". |
| **GL Account Linking** | `src/app/actions/people.ts` | `linkGLAccount` function handles mapping between ERP IDs and GL codes. |
| **Fiscal Year Refresh** | `src/app/(privileged)/finance/(definitions)/fiscal-years/page.tsx` | Auto-refresh trigger after creating a new year. |
| **Multi-Currency** | `src/lib/utils/units.ts` | `Decimal` type conversion logic for high precision. |

## 2. SaaS & Administration
| Feature | Path | Critical Logic |
| :--- | :--- | :--- |
| **Organization Switcher** | `src/app/(privileged)/saas/switcher/` | Handles session context switching between entities. |
| **Subscription Limits** | `src/app/(privileged)/saas/subscription-plans/[id]/page.tsx` | Enforces "Max Users", "Max Storage", etc. |
| **Module Toggles** | `src/app/actions/saas/modules.ts` | Controls feature visibility based on plan modules. |

## 3. Core Framework
| Feature | Path | Critical Logic |
| :--- | :--- | :--- |
| **Scope Access** | `src/app/(privileged)/layout.tsx` | Case-sensitive enum (`OFFICIAL`, `INTERNAL`) enforcement. |
| **Sidebar Hierarchy** | `src/components/ui/sidebar.tsx` | Multi-level navigation tree building. |
| **Type Shims** | `src/types/*.d.ts` | Path alias resolution and 3rd party module shimming. |

---

## Verification History
- **2026-02-22**: Initial Registry setup. Build verified 0 errors.
