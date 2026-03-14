# ADR-002: PostingResolver for GL Account Resolution

**Status**: Accepted
**Date**: 2026-03-14
**Decision Makers**: Core Architecture Team

## Context

Multiple POS and Sales services needed to resolve GL account IDs for journal entries. The pattern was:

```python
rules = ConfigurationService.get_posting_rules(organization)
account_id = rules['sales']['receivable']  # scattered, fragile, no validation
```

This caused duplicated boilerplate, no error messages when accounts were missing, and no support for the Tax Engine's `OrgTaxPolicy`.

## Decision

Centralize all GL account resolution through **PostingResolver** — a 3-layer resolution engine:

1. **OrgTaxPolicy** — tax-related events resolve from the Tax Engine configuration
2. **PostingRule model** — DB-managed rules override JSON rules
3. **JSON rules** — legacy `ConfigurationService.get_posting_rules()` fallback

```python
# ❌ Forbidden
account_id = rules['purchases']['payable']

# ✅ Required
account_id = PostingResolver.resolve(organization, 'purchases.payable')
```

## Rationale

- **Single source of truth** for all GL resolution
- **Meaningful errors** — `PostingResolver.resolve(org, key, required=True)` raises `ValidationError` with human-readable messages
- **Tax Engine integration** — tax events auto-resolve from `OrgTaxPolicy`
- **Contextual overrides** — supports warehouse/branch/category-specific account routing

## Consequences

- **Positive**: 9 integration tests validate all 3 layers; zero direct `rules[...]` access in POS
- **Negative**: Adds dependency on `PostingResolver` import in services
- **Enforcement**: Fitness check #11 tracks `get_posting_rules` baseline (≤25 calls outside finance)
