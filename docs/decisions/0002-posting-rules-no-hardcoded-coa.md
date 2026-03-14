# ADR-0002: Finance Posting Rules — No Hardcoded COA

## Status

ACCEPTED

## Context

An ERP system managing accounting across multiple countries, chart-of-account templates (IFRS, PCG, OHADA), and tenant-specific customizations cannot use hardcoded account codes. Previous implementations had account codes like `"411000"` or `"401000"` scattered across POS, inventory, and procurement logic.

This created:
- Breakage when tenants used different COA templates
- Inability to support regional accounting standards
- Audit risk: no single source of truth for account resolution

## Decision

**All account codes must be resolved dynamically via PostingRule configuration.**

1. `PostingRule` model defines the mapping: `(transaction_type, scope) → account_code`
2. `PostingResolver` service resolves the correct account at runtime
3. Zero hardcoded account codes in production paths
4. Fitness test enforces this: `check-architecture-fitness.sh` (check #2)

```python
# ✅ CORRECT — dynamic resolution
account = PostingResolver.resolve("purchase_vat", scope="OFFICIAL")

# ❌ FORBIDDEN — hardcoded
account_code = "445660"
```

## Consequences

### Positive
- Multi-tenant safe: each organization can customize its COA
- Multi-country ready: IFRS, PCG, OHADA all work
- Audit-grade: single resolution path, fully traceable
- Testable: posting rules can be seeded and verified

### Negative
- Requires posting rules to be seeded before first use
- Slightly more complex than direct account assignment
- Migration required to move existing hardcoded references

### Neutral
- 1 known hardcoded reference remains in `posting_rule.py:107` (tracked)

## References

- PostingRule model: `erp_backend/apps/finance/models/posting_rule.py`
- PostingResolver: `erp_backend/apps/finance/services/posting_resolver.py`
- Workflow: `.agents/workflows/posting-rules-enforcement.md`
- Fitness test: `scripts/ci/check-architecture-fitness.sh` (check #2)
