# ADR-003: Multi-Tenant Isolation via Middleware

**Status**: Accepted
**Date**: 2026-02-15
**Decision Makers**: Core Architecture Team

## Context

TSFSYSTEM serves multiple organizations from a single deployment. Each organization's data must be completely isolated — no cross-tenant data leaks.

## Decision

Tenant isolation is enforced at 3 layers:

1. **Middleware** (`TenantMiddleware`) — resolves organization from hostname/subdomain and attaches it to `request.tenant`
2. **Model layer** — every business model has an `organization` ForeignKey; no global queries
3. **ViewSet layer** — base viewsets auto-filter `queryset.filter(organization=request.tenant)`

## Rationale

- **Defense in depth** — even if a view forgets to filter, the middleware + base viewset provides protection
- **Hostname routing** — `org-slug.developos.shop` → tenant resolution without URL parameters
- **SaaS readiness** — supports unlimited organizations with shared infrastructure

## Consequences

- **Positive**: Complete data isolation; zero cross-tenant queries in production
- **Negative**: Every query must include organization filter; slight performance overhead
- **Gotcha**: Some fields use `tenant` instead of `organization` — see tenant field naming conventions documentation
