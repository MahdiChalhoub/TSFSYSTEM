# ADR-0003: Multi-Tenant Isolation via Middleware

## Status

ACCEPTED

## Context

TSFSYSTEM serves multiple organizations from a single database and application instance (shared-schema multi-tenancy). Each organization's data must be completely isolated. The system supports:
- Subdomain-based routing (`org1.example.com`)
- Session-based organization context
- API-level tenant enforcement

## Decision

**Tenant isolation is enforced at the middleware layer, not at the model layer.**

1. `TenantMiddleware` resolves the current tenant from the request (subdomain → session → API header)
2. All QuerySets are automatically scoped to `tenant=request.tenant`
3. Models use `tenant` field (not `organization`) for consistency
4. The `tenant` field is a ForeignKey to `Organization`
5. No model may expose unscoped querysets in views or APIs

```python
# ✅ CORRECT — scoped by middleware
queryset = Product.objects.filter(tenant=request.tenant)

# ❌ DANGEROUS — unscoped
queryset = Product.objects.all()
```

## Consequences

### Positive
- Single enforcement point: middleware
- Impossible to accidentally leak cross-tenant data (if middleware is correct)
- New models automatically scoped when they follow the pattern

### Negative
- Background tasks (Celery) must explicitly pass tenant context
- Shell/management commands need manual tenant context
- Some legacy code uses `organization=` instead of `tenant=`

### Neutral
- Known naming inconsistency: some models use `organization_id`, others `tenant_id`
- Migration to consistent naming is ongoing

## References

- TenantMiddleware: `erp_backend/core/middleware.py`
- SaaS models: `erp_backend/apps/saas/`
- KI: TSFSYSTEM SaaS Multi-tenancy Architecture
