# Reference Module

## Overview
Manages reference data used across the ERP system, including countries, currencies, units of measure, tax codes, and other master data. Provides centralized configuration for business rules.

## Key Features
- Country and region master data
- Multi-currency support with exchange rates
- Units of measure (UOM) with conversions
- Tax code definitions
- Industry classifications
- Payment terms templates
- Fiscal periods and calendars

## Core Models
- **Country**: ISO country codes, regions, tax jurisdictions
- **Currency**: ISO currency codes, exchange rates
- **Unit**: Units of measure (kg, m, pcs, etc.)
- **TaxCode**: Tax rate definitions by jurisdiction
- **FiscalPeriod**: Accounting periods
- **PaymentTerm**: Standard payment terms (Net 30, etc.)

## API Endpoints
- GET `/api/reference/countries/`
- GET `/api/reference/currencies/`
- GET `/api/reference/exchange-rate/?from=USD&to=EUR`
- GET `/api/reference/units/`
- POST `/api/reference/units/convert/` - UOM conversions

## Business Logic

### Currency Conversion
```python
from apps.reference.services import CurrencyService

amount_usd = CurrencyService.convert(
    amount=100.00,
    from_currency='EUR',
    to_currency='USD',
    date=today()
)
```

### Unit Conversion
```python
from apps.reference.models import Unit

kilograms = Unit.objects.get(code='KG')
grams = kilograms.convert_to('G', quantity=5)  # Returns 5000
```

## Configuration
- `AUTO_UPDATE_EXCHANGE_RATES`: Fetch rates daily (default: True)
- `EXCHANGE_RATE_PROVIDER`: API provider (default: 'ecb')
- `BASE_CURRENCY`: Organization base currency
- `TAX_CALCULATION_METHOD`: Inclusive or exclusive

## Dependencies
- Depends on: core
- Depended on by: finance, inventory, sales, purchase (virtually all modules)

**Last Updated**: 2026-03-14
**Module Status**: Production
**Critical Module**: YES - Foundation for multi-currency, UOM
