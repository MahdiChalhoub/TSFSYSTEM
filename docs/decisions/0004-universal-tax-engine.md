# ADR-0004: Universal Tax Engine

## Status

ACCEPTED

## Context

TSFSYSTEM needs to handle tax computation across multiple countries with different VAT regimes, withholding taxes, compound taxes (tax-on-tax), and destination-based jurisdiction rules. Previously, tax logic was scattered: AIRSI was hardcoded, VAT rates were per-policy, and jurisdiction rules didn't exist.

## Decision

**A centralized, rule-driven Universal Tax Engine handles all tax computation.**

Architecture:
1. `OrgTaxPolicy` — per-organization tax configuration
2. `CounterpartyTaxProfile` — per-supplier/customer tax settings
3. `CustomTaxRule` — user-defined tax rules with compound support (`tax_base_mode`: HT/TTC/PREVIOUS_TAX)
4. `TaxJurisdictionRule` — destination-based jurisdiction resolution
5. `TaxCalculator` — stateless calculator, deterministic ordering via `calculation_order`
6. `JurisdictionResolverService` — resolves origin + destination → applicable rules

Tax lines are computed as arrays, not single values, supporting multi-tax order lines with distinct behaviors (deductible, non-deductible, withholding, refundable).

## Consequences

### Positive
- Multi-country ready without code changes
- Compound taxes (tax-on-tax) supported generically
- Destination-based rules for import/export/inter-state
- Frontend components reusable: `TaxLinePreviewTable`, `TaxExplanationDrawer`, `JurisdictionPreview`
- AIRSI and all withholding taxes are now generic rules, not hardcoded

### Negative
- Requires seeding tax rules per country/regime
- More complex than simple percentage multiplication
- Frontend integration requires `taxLines` array plumbing

### Neutral
- 12/12 compound tests, 7/7 destination tests passing
- Integrated into POS `CartTotals` and purchase order detail page

## References

- Tax Calculator: `erp_backend/apps/finance/tax_calculator.py`
- Jurisdiction Resolver: `erp_backend/apps/finance/services/jurisdiction_resolver_service.py`
- Models: `erp_backend/apps/finance/models/`
- Frontend: `src/components/finance/`
- Server actions: `src/app/actions/finance/tax-engine.ts`
