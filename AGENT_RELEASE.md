# Agent Deployment Tracker

This file tracks deployments and changes made by AI agents to the TSFSYSTEM platform.

## Current Version: 2.8.2-AG-260223.1548 (Antigravity)

### Deployment Log

| Date | Agent | Version | Changes |
| :--- | :--- | :--- | :--- |
| 2026-02-23 | Antigravity | 2.8.2-AG-260223.1548 | **The Infrastructure Stability Patch**: Fixed `ReferenceError: Cannot access before initialization` in `PortalContext.tsx` by reordering definitions to avoid TDZ. Patched `erp-api.ts` for safe client-side execution by wrapping server-only imports in `isClient` checks. Fixed 404 in `getCommercialContext` by correcting the `/api/settings/global_financial/` endpoint. Rebuild optimized with full project sync. |
| 2026-02-23 | Antigravity | 2.9.0-AG | **Import Audit & Optimization**: Increased upload limits to 500MB. Implemented background asynchronous analysis for large SQL dumps. Optimized parser with single-pass scanning and streaming SS-cursors for DB connections. Added Taxes and Opening Stock migration. Implemented bulk creation for order lines. |
| 2026-02-23 | Antigravity | 2.8.2-AG-260223.1516 | **The Stability Patch**: Fixed POS Layout duplication errors (Numpad naming conflict). Resolved Storefront "Application Error" caused by circular theme dependencies. Standardized backend resolution across SSR components (localhost -> backend:8000). |
| 2026-02-23 | Antigravity | 2.8.2-AG-260223.1512 | Fixed '413 Request Entity Too Large' on Third-Party Import. Increased Nginx & Django upload limits to 500MB. |
| 2026-02-23 | Antigravity | 2.8.2-AG-260223.1239 | **Marketplace Revolution (Phase 7)**: Launched "Emporium" theme (+ Marketplace Header/Footer/Grid/Detail), Fixed Public Product API routing in Storefront Engine. |
| 2026-02-23 | Antigravity | 2.8.2-AG-260223.1237 | **Major Module Upgrade**: Deployed the "Unified Document Engine" to the Purchases module. Added Intelligence Sidebar (real-time stock/sales/expiry alerts), Global Discounts, Nested Extra Fees (delivery/customs), and Immediate Payment recording. Database schema updated production-wide. |
| 2026-02-23 | Antigravity | 2.8.2-AG-260223.0405 | **Critical Portal Fix**: Resolved Theme Manager and Portal 404s by aligning frontend paths with backend module notation (`client-portal` -> `client_portal`). |
| 2026-02-23 | Antigravity | 2.8.2-AG-260223.0355 | Fixed Brands page crash (Backend Hierarchy mapping fix), Fixed Attributes Page 'Linked Categories' crash and pagination bugs. |
| 2026-02-23 | Antigravity | 2.8.2-AG-260223.0340 | Refactored Categories & Units to TreeView, Fixed 'O is not iterable' crash, Implemented Stock Adjustments & Transfers Expandable UI. |
| 2026-02-23 | Antigravity | 2.8.2-AG-240223.0246 | Fixed POS prices ($0.00 bug), Fixed categories 404, Added Cart Highlighting (flash + persistent), Added version display near Sign Out. |
| 2026-02-23 | Antigravity | 2.8.2-AG-240223.0130 | Initial POS refinements, backend search expansion. |
