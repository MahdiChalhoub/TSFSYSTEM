# Agent Deployment Tracker

This file tracks deployments and changes made by AI agents to the TSFSYSTEM platform.

## Current Version: 2.9.4-AG (Antigravity)

### Deployment Log

| Date | Agent | Version | Changes |
| :--- | :--- | :--- | :--- |
| 2026-02-24 | Antigravity | 2.9.4-AG-260224.2310 | **Quality Blitz**: Standardized API error handler (consistent JSON envelopes with request_id). Global pagination (100/page). `django_filters` integration. Test mode auto-overrides (LocMemCache, MD5 hasher). 26 CRM loyalty tests + 20 HR model tests + 6 error handler tests = 46 new tests. Total: **198 tests all passing in 8s**. |
| 2026-02-24 | Antigravity | 2.9.3-AG-260224.2245 | **Quality & Test Coverage Sprint**: Added Swagger API docs at `/api/docs/` (drf-spectacular). Fixed ecommerce serializer bug (`tax_total`→`tax_amount`). Added Docker health checks on all services (db/redis/backend). Added DB connection pooling (CONN_MAX_AGE=600). Added Redis cache backend. Added structured JSON logging in production. Wrote 41 new tests: 22 POS integrity tests (immutability, hash chain, order lifecycle) + 19 API endpoint integration tests (auth, inventory, finance, POS, tenant isolation). Total: **146 tests all passing**. |
| 2026-02-24 | Antigravity | 2.9.2-AG-260224.2210 | **Security Hardening (Phase 1)**: Added 7 Nginx security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, XSS-Protection, Referrer-Policy, Permissions-Policy). Added API rate limiting (30r/s) and login brute-force protection (3r/min). Hardened CORS (forced ALLOW_ALL=False). Added production Django security settings (secure cookies, HSTS, content sniffing prevention). Enabled gzip compression. Added CDN cache headers for static assets. Cleaned 31 debug files from root. Updated .gitignore. |
| 2026-02-24 | Antigravity | 2.9.1-AG-260224.2140 | **Core Bug Fix Release**: Fixed StockBatch→ProductBatch import (POS purchases), AIRSI tax rate resolution (0% bug), POS immutability guard in quick_purchase, tenant context leak on exceptions, audit logging transaction poisoning, middleware session auth support. Fixed all 108 tests across finance, inventory, permissions, connector, tenant isolation, and mixed tax modules. |
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
