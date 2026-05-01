# Page Production Readiness Dashboard

**Generated**: 2026-05-01T00:44:40.540Z
**Pages scanned**: 756
**Scan time**: 0.3s

> Mechanical checks only (no tsc / eslint). For per-page deep dive run
> `node .ai/scripts/check_page_ready.js <path>`. Manual review items
> (#10 security 11/10, #11 maintenance 11/10) are not in this dashboard.

---

## Summary

- Ship-ready (**8 / 8** mechanical): **1** of 756 pages — 0.1%
- Average score: **4.09 / 8**
- Pages with **0 / 8** (worst): 0
- Pages with **≥ 6 / 8** (close): 18

## Most common gaps

| Gap | Pages affected | % of total |
|---|---:|---:|
| Tour (desktop+mobile+anchors) | 755 | 99.9% |
| i18n usage | 749 | 99.1% |
| Design signals (shell/text/hex) | 731 | 96.7% |
| Mobile responsive | 604 | 79.9% |
| File size ≤ 400 LOC | 60 | 7.9% |
| Tenancy/permissions | 47 | 6.2% |
| TODO/FIXME/console.log | 7 | 0.9% |

## Worst 30 pages overall

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 2/8 | `src/app/(privileged)/migration_v2/jobs/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, TODO/FIXME/console.log, Design signals (shell/text/hex) | 731 |
| 2/8 | `src/app/(privileged)/purchases/verification/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, TODO/FIXME/console.log, Design signals (shell/text/hex) | 494 |
| 2/8 | `src/app/(store)/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, TODO/FIXME/console.log, Design signals (shell/text/hex), Tenancy/permissions | 129 |
| 3/8 | `src/app/(privileged)/inventory/product-groups/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 1347 |
| 3/8 | `src/app/(privileged)/inventory/pos-settings/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 932 |
| 3/8 | `src/app/(privileged)/(saas)/connector/policies/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 812 |
| 3/8 | `src/app/(privileged)/finance/ledger/import/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 751 |
| 3/8 | `src/app/(privileged)/access/roles/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, TODO/FIXME/console.log, Design signals (shell/text/hex) | 701 |
| 3/8 | `src/app/(privileged)/inventory/product-groups/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 680 |
| 3/8 | `src/app/(privileged)/(saas)/listview-policies/edit/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 600 |
| 3/8 | `src/app/(privileged)/finance/settings/form-definitions/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 565 |
| 3/8 | `src/app/(privileged)/sales/discounts/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 513 |
| 3/8 | `src/app/(privileged)/(saas)/encryption/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 469 |
| 3/8 | `src/app/(privileged)/access/client-access/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 467 |
| 3/8 | `src/app/(privileged)/crm/contacts/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 461 |
| 3/8 | `src/app/(privileged)/access/approvals/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 445 |
| 3/8 | `src/app/(privileged)/purchases/invoice-verification/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 442 |
| 3/8 | `src/app/(privileged)/finance/assets/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 421 |
| 3/8 | `src/app/(privileged)/finance/budgets/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 421 |
| 3/8 | `src/app/(privileged)/access/supplier-access/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 416 |
| 3/8 | `src/app/(auth)/register/business/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex), Tenancy/permissions | 414 |
| 3/8 | `src/app/(privileged)/finance/profit-distribution/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 401 |
| 3/8 | `src/app/(public)/design-demo/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 347 |
| 3/8 | `src/app/delivery/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 305 |
| 3/8 | `src/app/tenant/[slug]/account/orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 305 |
| 3/8 | `src/app/(public)/_theme-layout-demo-disabled/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 302 |
| 3/8 | `src/app/supplier-portal/[slug]/profile/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 262 |
| 3/8 | `src/app/tenant/[slug]/account/wallet/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 258 |
| 3/8 | `src/app/tenant/[slug]/account/profile/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 231 |
| 3/8 | `src/app/tenant/[slug]/quote/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 224 |

---

## By section

### (auth) · forgot-password  ·  1 page  ·  avg 3.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(auth)/forgot-password/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 112 |

### (auth) · login  ·  1 page  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(auth)/login/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 35 |

### (auth) · register  ·  2 pages  ·  avg 3.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(auth)/register/business/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex), Tenancy/permissions | 414 |
| 3/8 | `(auth)/register/user/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 189 |

### (auth) · reset-password  ·  1 page  ·  avg 3.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(auth)/reset-password/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 171 |

### (privileged) · (saas)  ·  28 pages  ·  avg 4.21/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(privileged)/(saas)/connector/policies/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 812 |
| 3/8 | `(privileged)/(saas)/encryption/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 469 |
| 3/8 | `(privileged)/(saas)/listview-policies/edit/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 600 |
| 4/8 | `(privileged)/(saas)/[...slug]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 85 |
| 4/8 | `(privileged)/(saas)/apps/[code]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 46 |
| 4/8 | `(privileged)/(saas)/connector/buffer/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 320 |
| 4/8 | `(privileged)/(saas)/connector/logs/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 239 |
| 4/8 | `(privileged)/(saas)/countries/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 571 |
| 4/8 | `(privileged)/(saas)/currencies/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 247 |
| 4/8 | `(privileged)/(saas)/e-invoice-standards/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 371 |
| 4/8 | `(privileged)/(saas)/kernel/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 232 |
| 4/8 | `(privileged)/(saas)/listview-policies/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 280 |
| 4/8 | `(privileged)/(saas)/modules/dependencies/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 239 |
| 4/8 | `(privileged)/(saas)/modules/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 488 |
| 4/8 | `(privileged)/(saas)/organizations/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 580 |
| 4/8 | `(privileged)/(saas)/subscription-plans/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 532 |
| 4/8 | `(privileged)/(saas)/subscription-plans/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 645 |
| 4/8 | `(privileged)/(saas)/subscription/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 215 |
| 4/8 | `(privileged)/(saas)/switcher/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 84 |
| 5/8 | `(privileged)/(saas)/[code]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 85 |
| 5/8 | `(privileged)/(saas)/connector/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 361 |
| 5/8 | `(privileged)/(saas)/country-tax-templates/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 317 |
| 5/8 | `(privileged)/(saas)/health/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 295 |
| 5/8 | `(privileged)/(saas)/organizations/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 239 |
| 5/8 | `(privileged)/(saas)/organizations/registrations/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 29 |
| 5/8 | `(privileged)/(saas)/payment-gateways/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 24 |
| 5/8 | `(privileged)/(saas)/saas-home/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 186 |
| 5/8 | `(privileged)/(saas)/updates/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 276 |

### (privileged) · access  ·  6 pages  ·  avg 3.33/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(privileged)/access/approvals/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 445 |
| 3/8 | `(privileged)/access/client-access/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 467 |
| 3/8 | `(privileged)/access/roles/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, TODO/FIXME/console.log, Design signals (shell/text/hex) | 701 |
| 3/8 | `(privileged)/access/supplier-access/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 416 |
| 4/8 | `(privileged)/access/supplier-dashboard/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 320 |
| 4/8 | `(privileged)/access/users/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 745 |

### (privileged) · agents  ·  1 page  ·  avg 5.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 5/8 | `(privileged)/agents/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 363 |

### (privileged) · approvals  ·  1 page  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/approvals/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 381 |

### (privileged) · client_portal  ·  48 pages  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/client_portal/admin-orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/admin-orders/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/admin-orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/admin-tickets/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/admin-tickets/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/admin-tickets/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/admin-wallets/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/admin-wallets/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/admin-wallets/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/cart-promotions/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/cart-promotions/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/cart-promotions/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/client-access/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/client-access/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/client-access/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/config/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/config/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/config/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/coupons/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/coupons/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/coupons/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/dashboard/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/dashboard/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/dashboard/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 269 |
| 4/8 | `(privileged)/client_portal/my-orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/my-orders/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/my-orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/my-tickets/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/my-tickets/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/my-tickets/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/my-wallet/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/my-wallet/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/my-wallet/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/order-lines/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/order-lines/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/order-lines/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/quote-requests/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/quote-requests/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/quote-requests/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/reviews/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/reviews/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/reviews/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/shipping-rates/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/shipping-rates/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/shipping-rates/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/client_portal/wishlist/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/client_portal/wishlist/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/client_portal/wishlist/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |

### (privileged) · crm  ·  20 pages  ·  avg 4.40/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(privileged)/crm/contacts/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 461 |
| 4/8 | `(privileged)/crm/client-gate-preview/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/crm/contacts/[id]/edit/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 83 |
| 4/8 | `(privileged)/crm/contacts/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 69 |
| 4/8 | `(privileged)/crm/insights/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 265 |
| 4/8 | `(privileged)/crm/price-groups/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/crm/price-groups/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/crm/price-rules/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/crm/price-rules/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/crm/settings/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 195 |
| 4/8 | `(privileged)/crm/settings/tags/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 414 |
| 4/8 | `(privileged)/crm/supplier-gate-preview/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/crm/supplier-performance/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 222 |
| 5/8 | `(privileged)/crm/contacts/legacy/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage | 141 |
| 5/8 | `(privileged)/crm/contacts/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 129 |
| 5/8 | `(privileged)/crm/dashboard/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 281 |
| 5/8 | `(privileged)/crm/price-rules/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 143 |
| 5/8 | `(privileged)/crm/pricing/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 139 |
| 6/8 | `(privileged)/crm/followups/page.tsx` | Tour (desktop+mobile+anchors), Design signals (shell/text/hex) | 358 |
| 6/8 | `(privileged)/crm/price-groups/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 136 |

### (privileged) · dashboard  ·  2 pages  ·  avg 4.50/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/dashboard/legacy/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 418 |
| 5/8 | `(privileged)/dashboard/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 325 |

### (privileged) · delivery  ·  1 page  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/delivery/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 964 |

### (privileged) · dev  ·  5 pages  ·  avg 4.40/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/dev/templates/entity-products-tab/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 189 |
| 4/8 | `(privileged)/dev/templates/master-list-card/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 203 |
| 4/8 | `(privileged)/dev/templates/tree-master/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 184 |
| 5/8 | `(privileged)/dev/templates/master-list/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage | 117 |
| 5/8 | `(privileged)/dev/templates/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage | 107 |

### (privileged) · ecommerce  ·  16 pages  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/ecommerce/catalog/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 95 |
| 4/8 | `(privileged)/ecommerce/catalog/reviews/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 181 |
| 4/8 | `(privileged)/ecommerce/coupons/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 9 |
| 4/8 | `(privileged)/ecommerce/dashboard/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 93 |
| 4/8 | `(privileged)/ecommerce/orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/ecommerce/orders/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/ecommerce/orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 107 |
| 4/8 | `(privileged)/ecommerce/promotions/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 9 |
| 4/8 | `(privileged)/ecommerce/quotes/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 9 |
| 4/8 | `(privileged)/ecommerce/settings/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 24 |
| 4/8 | `(privileged)/ecommerce/shipping/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 2 |
| 4/8 | `(privileged)/ecommerce/storefront-config/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/ecommerce/storefront-config/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/ecommerce/storefront-config/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/ecommerce/themes/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 38 |
| 4/8 | `(privileged)/ecommerce/webhooks/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |

### (privileged) · finance  ·  160 pages  ·  avg 4.28/8  ·  1 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(privileged)/finance/assets/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 421 |
| 3/8 | `(privileged)/finance/budgets/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 421 |
| 3/8 | `(privileged)/finance/ledger/import/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 751 |
| 3/8 | `(privileged)/finance/profit-distribution/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 401 |
| 3/8 | `(privileged)/finance/settings/form-definitions/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 565 |
| 4/8 | `(privileged)/finance/account-book/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 257 |
| 4/8 | `(privileged)/finance/accounts/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 305 |
| 4/8 | `(privileged)/finance/accounts/new/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, TODO/FIXME/console.log, Design signals (shell/text/hex) | 360 |
| 4/8 | `(privileged)/finance/aging/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 266 |
| 4/8 | `(privileged)/finance/allocation-workbench/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/finance/assets/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/assets/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/audit-logs/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/audit-logs/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/audit-logs/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/audit-trail/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 254 |
| 4/8 | `(privileged)/finance/audit/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/audit/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/audit/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/balances/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/finance/bank-reconciliation/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 258 |
| 4/8 | `(privileged)/finance/bank-statements/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 109 |
| 4/8 | `(privileged)/finance/budget-lines/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 132 |
| 4/8 | `(privileged)/finance/budget/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 213 |
| 4/8 | `(privileged)/finance/budgets/alerts/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 358 |
| 4/8 | `(privileged)/finance/budgets/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 394 |
| 4/8 | `(privileged)/finance/budgets/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 396 |
| 4/8 | `(privileged)/finance/cash-register/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 324 |
| 4/8 | `(privileged)/finance/chart-of-accounts/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 51 |
| 4/8 | `(privileged)/finance/coa/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/coa/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/coa/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/collections/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/finance/counterparty-tax-profiles/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 678 |
| 4/8 | `(privileged)/finance/counterparty-tax-profiles/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 3 |
| 4/8 | `(privileged)/finance/currencies/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 17 |
| 4/8 | `(privileged)/finance/customer-balances/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/customer-balances/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/customer-balances/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/deferred-expenses/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/deferred-expenses/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/einvoice/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/einvoice/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/einvoice/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/einvoicing/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/finance/events/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 151 |
| 4/8 | `(privileged)/finance/events/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 229 |
| 4/8 | `(privileged)/finance/events/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 244 |
| 4/8 | `(privileged)/finance/expense-approvals/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 54 |
| 4/8 | `(privileged)/finance/expenses/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/expenses/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/expenses/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 205 |
| 4/8 | `(privileged)/finance/financial-events/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/financial-events/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/financial-events/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/fiscal-periods/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/fiscal-periods/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/fiscal-periods/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/gateway-configs/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/gateway-configs/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/gateway-configs/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/gateway/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/finance/gift-sample-vat/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 10 |
| 4/8 | `(privileged)/finance/import-declarations/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 10 |
| 4/8 | `(privileged)/finance/intra-branch-vat/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 10 |
| 4/8 | `(privileged)/finance/invoice-lines/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/invoice-lines/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/invoice-lines/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/invoices/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 539 |
| 4/8 | `(privileged)/finance/journal/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/journal/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/journal/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/ledger/[id]/edit/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 38 |
| 4/8 | `(privileged)/finance/ledger/opening/list/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 86 |
| 4/8 | `(privileged)/finance/loans/[id]/schedule/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 401 |
| 4/8 | `(privileged)/finance/loans/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 171 |
| 4/8 | `(privileged)/finance/loans/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 76 |
| 4/8 | `(privileged)/finance/org-tax-policies/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 663 |
| 4/8 | `(privileged)/finance/org-tax-policies/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 5 |
| 4/8 | `(privileged)/finance/payment-allocations/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/payment-allocations/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/payment-allocations/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/payment-approvals/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 61 |
| 4/8 | `(privileged)/finance/payments/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/payments/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/payments/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 553 |
| 4/8 | `(privileged)/finance/periodic-tax/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/periodic-tax/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/pricing/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 14 |
| 4/8 | `(privileged)/finance/profit-centers/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 220 |
| 4/8 | `(privileged)/finance/profit-distribution/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/profit-distribution/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/purchase-returns/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 238 |
| 4/8 | `(privileged)/finance/reconciliation-sessions/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 103 |
| 4/8 | `(privileged)/finance/reports/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/reports/aging/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 4 |
| 4/8 | `(privileged)/finance/reports/builder/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/finance/reports/cash-flow/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 314 |
| 4/8 | `(privileged)/finance/reports/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/reports/pnl/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 32 |
| 4/8 | `(privileged)/finance/reports/statement/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 23 |
| 4/8 | `(privileged)/finance/revenue/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 202 |
| 4/8 | `(privileged)/finance/self-supply-vat/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 10 |
| 4/8 | `(privileged)/finance/settings/barcode/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/settings/barcode/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/settings/barcode/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/settings/payment-methods/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 289 |
| 4/8 | `(privileged)/finance/setup/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 32 |
| 4/8 | `(privileged)/finance/statements/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 296 |
| 4/8 | `(privileged)/finance/supplier-balances/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/supplier-balances/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/supplier-balances/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/finance/tax-groups/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/tax-groups/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/tax-policy/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 593 |
| 4/8 | `(privileged)/finance/tax-rate-categories/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 427 |
| 4/8 | `(privileged)/finance/tax-reports/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 204 |
| 4/8 | `(privileged)/finance/vat-return/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/vat-return/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/vat-settlement/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/vat-settlement/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/vat-settlement/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 258 |
| 4/8 | `(privileged)/finance/vouchers/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/finance/vouchers/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/finance/vouchers/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 637 |
| 5/8 | `(privileged)/finance/account-categories/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 269 |
| 5/8 | `(privileged)/finance/accounts/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 238 |
| 5/8 | `(privileged)/finance/advance-payment-vat/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 297 |
| 5/8 | `(privileged)/finance/bad-debt-vat-claims/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 221 |
| 5/8 | `(privileged)/finance/counterparty-tax-profiles/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 163 |
| 5/8 | `(privileged)/finance/credit-note-vat/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 306 |
| 5/8 | `(privileged)/finance/custom-tax-rules/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 235 |
| 5/8 | `(privileged)/finance/dashboard/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 26 |
| 5/8 | `(privileged)/finance/deferred-expenses/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 341 |
| 5/8 | `(privileged)/finance/invoices/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 100 |
| 5/8 | `(privileged)/finance/ledger/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 342 |
| 5/8 | `(privileged)/finance/loans/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 5/8 | `(privileged)/finance/margin-scheme/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 110 |
| 5/8 | `(privileged)/finance/opening-balances/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 17 |
| 5/8 | `(privileged)/finance/org-tax-policies/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 261 |
| 5/8 | `(privileged)/finance/periodic-tax/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 132 |
| 5/8 | `(privileged)/finance/reports/dashboard/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 343 |
| 5/8 | `(privileged)/finance/reverse-charge/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 76 |
| 5/8 | `(privileged)/finance/sales-returns/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 334 |
| 5/8 | `(privileged)/finance/settings/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 5/8 | `(privileged)/finance/tax-groups/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 5/8 | `(privileged)/finance/vat-rate-history/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 80 |
| 5/8 | `(privileged)/finance/vat-return/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 133 |
| 5/8 | `(privileged)/finance/withholding-tax-rules/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 308 |
| 6/8 | `(privileged)/finance/fiscal-years/page.tsx` | Tour (desktop+mobile+anchors), Design signals (shell/text/hex) | 13 |
| 6/8 | `(privileged)/finance/ledger/new/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 20 |
| 6/8 | `(privileged)/finance/ledger/opening/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 12 |
| 6/8 | `(privileged)/finance/ledger/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 15 |
| 6/8 | `(privileged)/finance/reports/balance-sheet/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 21 |
| 6/8 | `(privileged)/finance/reports/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 270 |
| 6/8 | `(privileged)/finance/reports/trial-balance/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 14 |
| 6/8 | `(privileged)/finance/settings/posting-rules/page.tsx` | Tour (desktop+mobile+anchors), Design signals (shell/text/hex) | 22 |
| 7/8 | `(privileged)/finance/chart-of-accounts/migrate/page.tsx` | Tour (desktop+mobile+anchors) | 37 |
| 7/8 | `(privileged)/finance/chart-of-accounts/templates/page.tsx` | Tour (desktop+mobile+anchors) | 79 |
| **8/8** | `(privileged)/finance/chart-of-accounts/page.tsx` | — | 15 |

### (privileged) · home  ·  1 page  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/home/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 449 |

### (privileged) · hr  ·  17 pages  ·  avg 4.18/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/hr/attendance/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/hr/attendance/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/hr/attendance/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 65 |
| 4/8 | `(privileged)/hr/departments/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/hr/departments/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/hr/departments/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 60 |
| 4/8 | `(privileged)/hr/employees/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/hr/employees/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/hr/leaves/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/hr/leaves/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/hr/overview/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/hr/payroll/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 244 |
| 4/8 | `(privileged)/hr/shifts/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/hr/shifts/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 5/8 | `(privileged)/hr/employees/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 141 |
| 5/8 | `(privileged)/hr/leaves/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 65 |
| 5/8 | `(privileged)/hr/shifts/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 57 |

### (privileged) · integrations  ·  3 pages  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/integrations/webhooks/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/integrations/webhooks/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/integrations/webhooks/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |

### (privileged) · inventory  ·  123 pages  ·  avg 4.11/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(privileged)/inventory/pos-settings/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 932 |
| 3/8 | `(privileged)/inventory/product-groups/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 680 |
| 3/8 | `(privileged)/inventory/product-groups/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 1347 |
| 3/8 | `(privileged)/inventory/product-tasks/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, TODO/FIXME/console.log, Design signals (shell/text/hex) | 91 |
| 4/8 | `(privileged)/inventory/adjustment-orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/adjustment-orders/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/adjustment-orders/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 541 |
| 4/8 | `(privileged)/inventory/adjustments/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 54 |
| 4/8 | `(privileged)/inventory/aisles/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/aisles/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/aisles/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/alerts/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 178 |
| 4/8 | `(privileged)/inventory/analytics/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 655 |
| 4/8 | `(privileged)/inventory/barcode-policy/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/barcode/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 145 |
| 4/8 | `(privileged)/inventory/bins/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/bins/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/bins/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/brands/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 170 |
| 4/8 | `(privileged)/inventory/brands/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/brands/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 37 |
| 4/8 | `(privileged)/inventory/categories/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/categories/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/categories/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), TODO/FIXME/console.log, Design signals (shell/text/hex) | 26 |
| 4/8 | `(privileged)/inventory/category-rules/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 261 |
| 4/8 | `(privileged)/inventory/combo/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 58 |
| 4/8 | `(privileged)/inventory/counting-lines/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/counting-lines/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/counting-lines/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/counting-sessions/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/counting-sessions/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/counting-sessions/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/countries/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 119 |
| 4/8 | `(privileged)/inventory/expiry-alerts/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 312 |
| 4/8 | `(privileged)/inventory/fresh-profiles/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 133 |
| 4/8 | `(privileged)/inventory/fresh/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 244 |
| 4/8 | `(privileged)/inventory/goods-receipts/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 99 |
| 4/8 | `(privileged)/inventory/intelligence/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 255 |
| 4/8 | `(privileged)/inventory/inventory-group-members/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 97 |
| 4/8 | `(privileged)/inventory/inventory-groups/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 654 |
| 4/8 | `(privileged)/inventory/inventory-movements/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/inventory-movements/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/inventory-movements/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/inventory/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/inventory/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/inventory/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/label-policy/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 112 |
| 4/8 | `(privileged)/inventory/label-records/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 90 |
| 4/8 | `(privileged)/inventory/labels/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 340 |
| 4/8 | `(privileged)/inventory/listview-settings/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 289 |
| 4/8 | `(privileged)/inventory/low-stock/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 229 |
| 4/8 | `(privileged)/inventory/movements/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 48 |
| 4/8 | `(privileged)/inventory/packaging/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 653 |
| 4/8 | `(privileged)/inventory/parfums/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/parfums/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/parfums/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/policies/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 942 |
| 4/8 | `(privileged)/inventory/price-change-requests/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 102 |
| 4/8 | `(privileged)/inventory/price-governance/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 455 |
| 4/8 | `(privileged)/inventory/price-regulations/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 680 |
| 4/8 | `(privileged)/inventory/product-audit-trail/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 103 |
| 4/8 | `(privileged)/inventory/product-barcodes/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 92 |
| 4/8 | `(privileged)/inventory/product-groups/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 22 |
| 4/8 | `(privileged)/inventory/product-locations/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/product-locations/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/product-locations/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/products/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 570 |
| 4/8 | `(privileged)/inventory/products/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 102 |
| 4/8 | `(privileged)/inventory/racks/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/racks/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/racks/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/requests/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 277 |
| 4/8 | `(privileged)/inventory/serial-logs/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/serial-logs/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/serial-logs/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/serials/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/serials/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/serials/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 58 |
| 4/8 | `(privileged)/inventory/shelves/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/shelves/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/shelves/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/stock-alerts/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/stock-alerts/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/stock-alerts/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/stock-count/[id]/count/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 307 |
| 4/8 | `(privileged)/inventory/stock-count/[id]/verify/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 367 |
| 4/8 | `(privileged)/inventory/stock-count/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 446 |
| 4/8 | `(privileged)/inventory/stock-matrix/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 1203 |
| 4/8 | `(privileged)/inventory/stock-moves/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/stock-moves/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/stock-moves/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/sync/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/sync/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/sync/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/inventory/transfer-orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/transfer-orders/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/transfer-orders/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 540 |
| 4/8 | `(privileged)/inventory/transfers/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 63 |
| 4/8 | `(privileged)/inventory/units/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/units/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/units/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 21 |
| 4/8 | `(privileged)/inventory/valuation/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 289 |
| 4/8 | `(privileged)/inventory/warehouses/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/warehouses/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/weight-policy/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 111 |
| 4/8 | `(privileged)/inventory/zones/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/inventory/zones/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/inventory/zones/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 5/8 | `(privileged)/inventory/attributes/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 21 |
| 5/8 | `(privileged)/inventory/categories/maintenance/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 105 |
| 5/8 | `(privileged)/inventory/countries/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 19 |
| 5/8 | `(privileged)/inventory/gift-sample/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 337 |
| 5/8 | `(privileged)/inventory/global/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 47 |
| 5/8 | `(privileged)/inventory/internal-consumption/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 329 |
| 5/8 | `(privileged)/inventory/maintenance/data-quality/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC | 686 |
| 5/8 | `(privileged)/inventory/packages/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 66 |
| 5/8 | `(privileged)/inventory/product-explorer/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 10 |
| 5/8 | `(privileged)/inventory/readiness/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 209 |
| 5/8 | `(privileged)/inventory/transfers/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 271 |
| 5/8 | `(privileged)/inventory/warehouses/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 43 |
| 6/8 | `(privileged)/inventory/maintenance/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 242 |
| 6/8 | `(privileged)/inventory/packaging-suggestions/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 34 |
| 6/8 | `(privileged)/inventory/transfers/new/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 275 |

### (privileged) · marketplace  ·  1 page  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/marketplace/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 533 |

### (privileged) · mcp  ·  21 pages  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/mcp/agent-logs/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/mcp/agent-logs/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/mcp/agent-logs/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/mcp/agents/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/mcp/agents/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/mcp/agents/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/mcp/chat/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 55 |
| 4/8 | `(privileged)/mcp/conversations/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 287 |
| 4/8 | `(privileged)/mcp/conversations/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/mcp/conversations/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/mcp/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 2 |
| 4/8 | `(privileged)/mcp/providers/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/mcp/providers/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/mcp/providers/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/mcp/settings/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 2 |
| 4/8 | `(privileged)/mcp/tools/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/mcp/tools/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/mcp/tools/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/mcp/usage/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/mcp/usage/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/mcp/usage/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |

### (privileged) · migration  ·  5 pages  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/migration/audit/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 8 |
| 4/8 | `(privileged)/migration/jobs/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/migration/jobs/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/migration/jobs/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/migration/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 2 |

### (privileged) · migration_v2  ·  7 pages  ·  avg 3.86/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 2/8 | `(privileged)/migration_v2/jobs/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, TODO/FIXME/console.log, Design signals (shell/text/hex) | 731 |
| 4/8 | `(privileged)/migration_v2/jobs/[id]/edit/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 22 |
| 4/8 | `(privileged)/migration_v2/jobs/[id]/mappings/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 178 |
| 4/8 | `(privileged)/migration_v2/jobs/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/migration_v2/jobs/[id]/verification/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 203 |
| 4/8 | `(privileged)/migration_v2/jobs/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 128 |
| 5/8 | `(privileged)/migration_v2/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 286 |

### (privileged) · platform-dashboard  ·  1 page  ·  avg 5.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 5/8 | `(privileged)/platform-dashboard/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 380 |

### (privileged) · pos  ·  64 pages  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/pos/consignment-settlements/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/consignment-settlements/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/consignment-settlements/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/credit-notes/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/credit-notes/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/credit-notes/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/deliveries/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/deliveries/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/deliveries/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/delivery-zones/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/delivery-zones/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/delivery-zones/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/discount-rules/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/discount-rules/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/discount-rules/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/manager-address-book/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/manager-address-book/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/manager-address-book/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/orders/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/po-lines/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/po-lines/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/po-lines/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/pos-audit-events/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/pos-audit-events/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/pos-audit-events/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/pos-audit-rules/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/pos-audit-rules/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/pos-audit-rules/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/pos-registers/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/pos-registers/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/pos-registers/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/pos-settings/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/pos-settings/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/pos-settings/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/pos-tickets/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/pos-tickets/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/pos-tickets/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/pos/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/pos/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/pos/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/purchase-orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 211 |
| 4/8 | `(privileged)/pos/purchase-orders/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/purchase-orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/purchase-returns/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/purchase-returns/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/purchase-returns/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/purchase/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/purchase/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/purchase/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/quotations/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/quotations/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/quotations/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/sales-returns/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/sales-returns/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/sales-returns/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/sourcing/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/sourcing/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/sourcing/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/pos/supplier-package-prices/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 101 |
| 4/8 | `(privileged)/pos/supplier-pricing/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/pos/supplier-pricing/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/pos/supplier-pricing/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |

### (privileged) · procurement  ·  1 page  ·  avg 5.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 5/8 | `(privileged)/procurement/import-declarations/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 362 |

### (privileged) · products  ·  6 pages  ·  avg 4.50/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/products/create-group/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 40 |
| 4/8 | `(privileged)/products/groups/[id]/edit/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 50 |
| 4/8 | `(privileged)/products/legacy/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 176 |
| 5/8 | `(privileged)/products/[id]/edit/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 111 |
| 5/8 | `(privileged)/products/new/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 5/8 | `(privileged)/products/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 271 |

### (privileged) · purchases  ·  20 pages  ·  avg 4.40/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 2/8 | `(privileged)/purchases/verification/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, TODO/FIXME/console.log, Design signals (shell/text/hex) | 494 |
| 3/8 | `(privileged)/purchases/invoice-verification/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 442 |
| 4/8 | `(privileged)/purchases/approvals/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 54 |
| 4/8 | `(privileged)/purchases/dashboard/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 222 |
| 4/8 | `(privileged)/purchases/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 6 |
| 4/8 | `(privileged)/purchases/receipts/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 21 |
| 4/8 | `(privileged)/purchases/receipts/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/purchases/returns/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 233 |
| 4/8 | `(privileged)/purchases/returns/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 130 |
| 5/8 | `(privileged)/purchases/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 296 |
| 5/8 | `(privileged)/purchases/consignments/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 128 |
| 5/8 | `(privileged)/purchases/credit-notes/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 132 |
| 5/8 | `(privileged)/purchases/invoices/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 5/8 | `(privileged)/purchases/invoicing/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 22 |
| 5/8 | `(privileged)/purchases/new-order-v2/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 61 |
| 5/8 | `(privileged)/purchases/new/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 61 |
| 5/8 | `(privileged)/purchases/purchase-orders/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 39 |
| 5/8 | `(privileged)/purchases/quotations/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 141 |
| 5/8 | `(privileged)/purchases/receiving/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 14 |
| 5/8 | `(privileged)/purchases/sourcing/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 147 |

### (privileged) · pv  ·  1 page  ·  avg 5.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 5/8 | `(privileged)/pv/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 60 |

### (privileged) · sales  ·  22 pages  ·  avg 4.09/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(privileged)/sales/discounts/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 513 |
| 4/8 | `(privileged)/sales/analytics/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 325 |
| 4/8 | `(privileged)/sales/audit/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 44 |
| 4/8 | `(privileged)/sales/consignment-settlements/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/sales/consignment/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 34 |
| 4/8 | `(privileged)/sales/credit-notes/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 178 |
| 4/8 | `(privileged)/sales/deliveries/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 327 |
| 4/8 | `(privileged)/sales/delivery-zones/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 284 |
| 4/8 | `(privileged)/sales/drivers/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 3 |
| 4/8 | `(privileged)/sales/history/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 247 |
| 4/8 | `(privileged)/sales/orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 37 |
| 4/8 | `(privileged)/sales/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 10 |
| 4/8 | `(privileged)/sales/pos-settings/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 532 |
| 4/8 | `(privileged)/sales/quotations/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 59 |
| 4/8 | `(privileged)/sales/registers/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 333 |
| 4/8 | `(privileged)/sales/returns/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 235 |
| 4/8 | `(privileged)/sales/returns/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 131 |
| 4/8 | `(privileged)/sales/sessions/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 270 |
| 4/8 | `(privileged)/sales/supermarche/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 50 |
| 5/8 | `(privileged)/sales/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 207 |
| 5/8 | `(privileged)/sales/import/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 88 |
| 5/8 | `(privileged)/sales/summary/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 263 |

### (privileged) · settings  ·  17 pages  ·  avg 4.53/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/settings/audit-trail/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 537 |
| 4/8 | `(privileged)/settings/branding/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 42 |
| 4/8 | `(privileged)/settings/e-invoicing/monitor/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 14 |
| 4/8 | `(privileged)/settings/e-invoicing/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/settings/features/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 16 |
| 4/8 | `(privileged)/settings/notifications/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 207 |
| 4/8 | `(privileged)/settings/pos-settings/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 8 |
| 4/8 | `(privileged)/settings/sequences/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 381 |
| 5/8 | `(privileged)/settings/appearance/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 365 |
| 5/8 | `(privileged)/settings/domains/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC | 484 |
| 5/8 | `(privileged)/settings/payment-terms/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 35 |
| 5/8 | `(privileged)/settings/print-branding/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 51 |
| 5/8 | `(privileged)/settings/purchase-analytics/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 297 |
| 5/8 | `(privileged)/settings/regional/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 28 |
| 5/8 | `(privileged)/settings/roles/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 30 |
| 5/8 | `(privileged)/settings/security/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 88 |
| 5/8 | `(privileged)/settings/whatsapp/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage | 257 |

### (privileged) · setup-wizard  ·  1 page  ·  avg 5.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 5/8 | `(privileged)/setup-wizard/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 26 |

### (privileged) · storage  ·  5 pages  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/storage/files/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/storage/files/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/storage/files/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/storage/packages/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 6 |
| 4/8 | `(privileged)/storage/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 2 |

### (privileged) · supplier_portal  ·  33 pages  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/supplier_portal/admin-price-requests/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/admin-price-requests/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/admin-price-requests/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/admin-proformas/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/admin-proformas/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/admin-proformas/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/config/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/config/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/config/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/dashboard/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/dashboard/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/dashboard/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/my-notifications/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/my-notifications/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/my-notifications/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/my-orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/my-orders/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/my-orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/my-price-requests/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/my-price-requests/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/my-price-requests/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/my-proformas/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/my-proformas/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/my-proformas/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/my-stock/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/my-stock/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/my-stock/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/portal-access/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/portal-access/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/portal-access/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/supplier_portal/proforma-lines/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/supplier_portal/proforma-lines/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/supplier_portal/proforma-lines/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |

### (privileged) · theme-demo  ·  1 page  ·  avg 5.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 5/8 | `(privileged)/theme-demo/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 385 |

### (privileged) · ui-kit  ·  1 page  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/ui-kit/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 623 |

### (privileged) · users  ·  2 pages  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/users/approvals/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 316 |
| 4/8 | `(privileged)/users/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 6 |

### (privileged) · workspace  ·  68 pages  ·  avg 4.16/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `(privileged)/workspace/auto-rules/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/auto-task-health/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 408 |
| 4/8 | `(privileged)/workspace/auto-task-settings/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC, Design signals (shell/text/hex) | 457 |
| 4/8 | `(privileged)/workspace/categories/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/categories/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/categories/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/checklist-items/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/checklist-items/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/checklist-items/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/checklist-templates/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/checklist-templates/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/checklist-templates/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/checklists/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/checklists/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/checklists/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 69 |
| 4/8 | `(privileged)/workspace/client-access/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 54 |
| 4/8 | `(privileged)/workspace/client-orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 48 |
| 4/8 | `(privileged)/workspace/client-portal/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/workspace/client-tickets/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 48 |
| 4/8 | `(privileged)/workspace/comments/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/comments/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/comments/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/config/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/config/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/config/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/evaluations/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/evaluations/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/evaluations/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/kpi-config/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/kpi-config/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/kpi-config/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/performance/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/performance/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/portal-config/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 57 |
| 4/8 | `(privileged)/workspace/price-requests/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 52 |
| 4/8 | `(privileged)/workspace/proformas/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 52 |
| 4/8 | `(privileged)/workspace/questionnaires/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/questionnaires/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/questionnaires/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/questions/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/questions/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/questions/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/quote-inbox/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 49 |
| 4/8 | `(privileged)/workspace/requests/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/requests/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/requests/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/scores/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/scores/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/scores/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/supplier-access/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 53 |
| 4/8 | `(privileged)/workspace/supplier-portal/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 12 |
| 4/8 | `(privileged)/workspace/tasks/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/tasks/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/templates/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 156 |
| 4/8 | `(privileged)/workspace/templates/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 117 |
| 4/8 | `(privileged)/workspace/templates/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 87 |
| 4/8 | `(privileged)/workspace/tenders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 197 |
| 4/8 | `(privileged)/workspace/wise-console/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 173 |
| 4/8 | `(privileged)/workspace/wise-rules/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 155 |
| 5/8 | `(privileged)/workspace/auto-rules/new/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage | 145 |
| 5/8 | `(privileged)/workspace/auto-rules/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 282 |
| 5/8 | `(privileged)/workspace/auto-task-rules/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC | 1653 |
| 5/8 | `(privileged)/workspace/leader-tree/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage | 226 |
| 5/8 | `(privileged)/workspace/overview/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, File size ≤ 400 LOC | 1018 |
| 5/8 | `(privileged)/workspace/performance/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 51 |
| 5/8 | `(privileged)/workspace/wise-adjustments/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex) | 92 |
| 6/8 | `(privileged)/workspace/tasks/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 40 |
| 6/8 | `(privileged)/workspace/user-groups/page.tsx` | Tour (desktop+mobile+anchors), i18n usage | 375 |

### (public) · _theme-layout-demo-disabled  ·  1 page  ·  avg 3.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(public)/_theme-layout-demo-disabled/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 302 |

### (public) · delivery  ·  1 page  ·  avg 3.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `delivery/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 305 |

### (public) · design-demo  ·  1 page  ·  avg 3.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `(public)/design-demo/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 347 |

### (public) · landing  ·  1 page  ·  avg 4.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 4/8 | `landing/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 313 |

### (public) · store  ·  11 pages  ·  avg 3.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `store/account/orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 167 |
| 3/8 | `store/account/orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 83 |
| 3/8 | `store/account/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 59 |
| 3/8 | `store/cart/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 164 |
| 3/8 | `store/catalog/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 146 |
| 3/8 | `store/catalog/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 166 |
| 3/8 | `store/checkout/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 213 |
| 3/8 | `store/login/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 104 |
| 3/8 | `store/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 93 |
| 3/8 | `store/register/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 104 |
| 3/8 | `store/wishlist/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 10 |

### (public) · supplier-portal  ·  8 pages  ·  avg 3.25/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `supplier-portal/[slug]/notifications/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 207 |
| 3/8 | `supplier-portal/[slug]/orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 122 |
| 3/8 | `supplier-portal/[slug]/price-requests/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 218 |
| 3/8 | `supplier-portal/[slug]/profile/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 262 |
| 3/8 | `supplier-portal/[slug]/proformas/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 184 |
| 3/8 | `supplier-portal/[slug]/statement/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 196 |
| 4/8 | `supplier-portal/[slug]/orders/[id]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 292 |
| 4/8 | `supplier-portal/[slug]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 281 |

### (public) · tenant  ·  18 pages  ·  avg 3.11/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 3/8 | `tenant/[slug]/account/notifications/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 195 |
| 3/8 | `tenant/[slug]/account/orders/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 305 |
| 3/8 | `tenant/[slug]/account/orders/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 138 |
| 3/8 | `tenant/[slug]/account/profile/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 231 |
| 3/8 | `tenant/[slug]/account/tickets/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 220 |
| 3/8 | `tenant/[slug]/account/wallet/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 258 |
| 3/8 | `tenant/[slug]/account/wishlist/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 143 |
| 3/8 | `tenant/[slug]/cart/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 19 |
| 3/8 | `tenant/[slug]/categories/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 22 |
| 3/8 | `tenant/[slug]/checkout/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 19 |
| 3/8 | `tenant/[slug]/dashboard/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 6 |
| 3/8 | `tenant/[slug]/login/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 21 |
| 3/8 | `tenant/[slug]/product/[id]/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 51 |
| 3/8 | `tenant/[slug]/quote/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 224 |
| 3/8 | `tenant/[slug]/register/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 217 |
| 3/8 | `tenant/[slug]/search/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 22 |
| 4/8 | `tenant/[slug]/account/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 232 |
| 4/8 | `tenant/[slug]/page.tsx` | Tour (desktop+mobile+anchors), i18n usage, Design signals (shell/text/hex), Tenancy/permissions | 50 |

### (store) · page.tsx  ·  1 page  ·  avg 2.00/8  ·  0 ship-ready

| Score | Page | Gaps | LOC |
|---|---|---|---:|
| 2/8 | `(store)/page.tsx` | Mobile responsive, Tour (desktop+mobile+anchors), i18n usage, TODO/FIXME/console.log, Design signals (shell/text/hex), Tenancy/permissions | 129 |

