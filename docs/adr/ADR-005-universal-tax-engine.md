# ADR-005: Universal Tax Engine

**Status**: Accepted
**Date**: 2026-03-13
**Decision Makers**: Core Architecture Team

## Context

The original tax system was hardcoded for specific company types (MICRO, REGULAR) with French-specific tax logic (TVA, AIRSI). This couldn't scale to multi-country operations or handle compound taxes, destination-based taxation, or custom tax rules.

## Decision

Replace hardcoded tax logic with a **Universal Tax Engine** built on:

1. **OrgTaxPolicy** — per-organization tax configuration (VAT rates, scope, regime)
2. **CounterpartyTaxProfile** — per-supplier/customer tax treatment
3. **CustomTaxRule** — user-defined tax rules for any scenario
4. **TaxJurisdictionRule** — destination-based taxation for cross-border operations
5. **PostingResolver integration** — tax GL accounts resolve through the centralized engine

### Key Capabilities
- **Multi-tax order lines** — a single line item can have VAT + AIRSI + withholding
- **Scope awareness** — Official vs Internal transactions with separate GL routing
- **3 cost views** — HT (before tax), TTC (customer pays), NET (company cost)
- **Country-agnostic** — tax rules are configurable, not hardcoded

## Rationale

- **Multi-country readiness** — supports any tax regime without code changes
- **Audit compliance** — every tax calculation is traceable through PostingResolver
- **Flexibility** — organizations can define custom tax rules through the admin UI

## Consequences

- **Positive**: Supports compound taxes, reverse-charge, exemptions, and settlement workflows
- **Negative**: Higher complexity than simple percentage-based taxation
- **Integration**: 9 PostingResolver integration tests validate tax account resolution
