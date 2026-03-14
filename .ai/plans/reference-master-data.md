# 🌐 Reference Master Data Module — Phase 1 Implementation Plan

**Task**: Build dedicated `apps/reference/` module with global country/currency master data and organization activation tables  
**Status**: ✅ IMPLEMENTED  
**Date**: 2026-03-12  
**Files Created**: 13 new files | **Files Modified**: 3 files

---

## 📊 Current State Analysis

| Entity | Current Implementation | Problem |
|--------|----------------------|---------|
| `GlobalCurrency` | `erp/models.py` — 3 fields: `name`, `code`, `symbol` | Missing `minor_unit`, `numeric_code`, `is_active` |
| `Country` | `erp/models.py` — 2 fields: `code`, `name` | Missing `iso3`, `official_name`, `phone_code`, `region`, `default_currency` |
| `Organization.country` | `CharField(max_length=100)` — plain text! | Not linked to Country model |
| `Organization.base_currency` | FK → `GlobalCurrency` | Works but no org activation table |
| Finance `Currency` | `apps/finance/models/currency_models.py` — tenant-scoped duplicate | Duplicates global data, no link to master |
| Country-Currency mapping | Does not exist | No way to express multi-currency countries |
| Org country/currency selection | Does not exist | No activation/deactivation layer |

### Existing Usage Map (must maintain backward compat during transition)
- `GlobalCurrency` — referenced in **~40 places** (views, serializers, migrations, seed scripts)
- `Country` — referenced in **~10 places** (views, serializers, seed scripts, inventory taxonomy)
- `Organization.base_currency` FK → `GlobalCurrency` — used in org setup, serializer, provisioning
- `Organization.country` CharField — used in org creation, SaaSClient sync
- Finance `Currency` — used by `JournalEntry`, `ExchangeRate`, `CurrencyRevaluation`, `ChartOfAccount`

---

## 🏗️ Architecture Decision

### Module: `apps/reference/`

**Why a dedicated module:**
- Countries and currencies are **global reference data**, not specific to finance, POS, or CRM
- Clean separation from the bloated `erp/models.py`
- Follows the existing `apps/` module pattern with auto-discovery
- Gets its own `urls.py`, `views.py`, `serializers.py`, `management commands`

### Table Naming: `ref_` prefix

| Model | Table Name |
|-------|------------|
| `Country` | `ref_countries` |
| `Currency` | `ref_currencies` |
| `CountryCurrencyMap` | `ref_country_currency_map` |
| `OrgCountry` | `ref_org_countries` |
| `OrgCurrency` | `ref_org_currencies` |

### Base Class Rules

| Model | Inherits From | Why |
|-------|--------------|-----|
| `Country` | `models.Model` | SaaS-level, not tenant-scoped (like `BusinessType`, `SystemModule`) |
| `Currency` | `models.Model` | SaaS-level, not tenant-scoped |
| `CountryCurrencyMap` | `models.Model` | SaaS-level mapping |
| `OrgCountry` | `AuditLogMixin, TenantOwnedModel` | Org-scoped activation — full architecture compliance |
| `OrgCurrency` | `AuditLogMixin, TenantOwnedModel` | Org-scoped activation — full architecture compliance |

---

## 📋 Files to Create

### 1. `apps/reference/__init__.py` — Empty init

### 2. `apps/reference/apps.py` — Django AppConfig
```python
from django.apps import AppConfig

class ReferenceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.reference'
    verbose_name = 'Reference Data'
```

### 3. `apps/reference/models.py` — All 5 models

#### 3a. `Country` — Global SaaS Reference
```python
class Country(models.Model):
    iso2 = models.CharField(max_length=2, unique=True, db_index=True,
        help_text='ISO 3166-1 alpha-2 code (e.g., US, FR, LB)')
    iso3 = models.CharField(max_length=3, unique=True, db_index=True,
        help_text='ISO 3166-1 alpha-3 code (e.g., USA, FRA, LBN)')
    numeric_code = models.CharField(max_length=3, blank=True, default='',
        help_text='ISO 3166-1 numeric code (e.g., 840, 250, 422)')
    name = models.CharField(max_length=255,
        help_text='Common English name')
    official_name = models.CharField(max_length=255, blank=True, default='',
        help_text='Official state name')
    phone_code = models.CharField(max_length=20, blank=True, default='',
        help_text='International dialing code (e.g., +1, +33, +961)')
    region = models.CharField(max_length=100, blank=True, default='',
        help_text='Geographic region (e.g., Americas, Europe, Asia)')
    subregion = models.CharField(max_length=100, blank=True, default='',
        help_text='Geographic subregion (e.g., Northern America, Western Europe)')
    default_currency = models.ForeignKey('Currency', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='default_for_countries',
        help_text='Primary/default currency for this country')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ref_countries'
        ordering = ['name']
        verbose_name_plural = 'Countries'

    def __str__(self):
        return f"{self.name} ({self.iso2})"
```

#### 3b. `Currency` — Global SaaS Reference
```python
class Currency(models.Model):
    code = models.CharField(max_length=3, unique=True, db_index=True,
        help_text='ISO 4217 alpha code (e.g., USD, EUR, XOF)')
    numeric_code = models.CharField(max_length=3, blank=True, default='',
        help_text='ISO 4217 numeric code (e.g., 840, 978, 952)')
    name = models.CharField(max_length=255,
        help_text='Currency name (e.g., US Dollar, Euro)')
    symbol = models.CharField(max_length=10, blank=True, default='',
        help_text='Currency symbol (e.g., $, €, £)')
    minor_unit = models.PositiveSmallIntegerField(default=2,
        help_text='Number of decimal places (e.g., 2 for USD, 0 for JPY)')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ref_currencies'
        ordering = ['code']
        verbose_name_plural = 'Currencies'

    def __str__(self):
        return f"{self.code} — {self.name}"
```

#### 3c. `CountryCurrencyMap` — SaaS-level mapping
```python
class CountryCurrencyMap(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE,
        related_name='currency_mappings')
    currency = models.ForeignKey(Currency, on_delete=models.CASCADE,
        related_name='country_mappings')
    is_primary = models.BooleanField(default=False,
        help_text='Primary currency for this country')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'ref_country_currency_map'
        unique_together = ('country', 'currency')
        ordering = ['country__name', '-is_primary']

    def __str__(self):
        primary = ' (Primary)' if self.is_primary else ''
        return f"{self.country.iso2} → {self.currency.code}{primary}"
```

#### 3d. `OrgCountry` — Tenant-scoped activation
```python
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin

class OrgCountry(AuditLogMixin, TenantOwnedModel):
    country = models.ForeignKey(Country, on_delete=models.CASCADE,
        related_name='org_activations')
    is_enabled = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False,
        help_text='Default/base country for this organization')
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'ref_org_countries'
        unique_together = ('organization', 'country')
        ordering = ['-is_default', 'display_order', 'country__name']
        indexes = [
            models.Index(fields=['organization', 'is_enabled']),
        ]

    def __str__(self):
        return f"{self.organization} → {self.country.iso2}"
```

#### 3e. `OrgCurrency` — Tenant-scoped activation
```python
class OrgCurrency(AuditLogMixin, TenantOwnedModel):
    EXCHANGE_RATE_SOURCES = [
        ('MANUAL', 'Manual Entry'),
        ('ECB', 'European Central Bank'),
        ('BCEAO', 'BCEAO (West Africa)'),
        ('IMPORT', 'Imported'),
    ]

    currency = models.ForeignKey(Currency, on_delete=models.CASCADE,
        related_name='org_activations')
    is_enabled = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False,
        help_text='Base/functional currency for this organization')
    display_order = models.PositiveIntegerField(default=0)
    exchange_rate_source = models.CharField(max_length=50, blank=True, default='MANUAL',
        choices=EXCHANGE_RATE_SOURCES,
        help_text='Default exchange rate source for this currency')
    is_reporting_currency = models.BooleanField(default=False,
        help_text='Used for consolidated reporting')
    is_transaction_currency = models.BooleanField(default=True,
        help_text='Allowed in transactional documents')

    class Meta:
        db_table = 'ref_org_currencies'
        unique_together = ('organization', 'currency')
        ordering = ['-is_default', 'display_order', 'currency__code']
        indexes = [
            models.Index(fields=['organization', 'is_enabled']),
        ]

    def __str__(self):
        return f"{self.organization} → {self.currency.code}"
```

### 4. `apps/reference/serializers.py`

```python
# Read-only serializers for global reference data
class CountrySerializer — all fields
class CurrencySerializer — all fields  
class CountryCurrencyMapSerializer — nested country/currency names
class CountryListSerializer — lightweight (id, iso2, name, phone_code, default_currency_code)

# Org-scoped serializers
class OrgCountrySerializer — with nested country details
class OrgCurrencySerializer — with nested currency details
class OrgCountryWriteSerializer — for enable/disable/set default
class OrgCurrencyWriteSerializer — for enable/disable/set default
```

### 5. `apps/reference/views.py`

```python
# SaaS Admin endpoints (read-only for regular users, full CRUD for staff)
class RefCountryViewSet — /api/reference/countries/
class RefCurrencyViewSet — /api/reference/currencies/
class RefCountryCurrencyMapViewSet — /api/reference/country-currency-map/

# Org-scoped endpoints (tenant-filtered)
class OrgCountryViewSet — /api/reference/org-countries/
class OrgCurrencyViewSet — /api/reference/org-currencies/

# Utility actions
@action: bulk-enable (enable multiple countries/currencies at once)
@action: set-default (mark one as default, unmark all others)
```

### 6. `apps/reference/urls.py`
```python
router.register(r'countries', RefCountryViewSet, basename='ref-countries')
router.register(r'currencies', RefCurrencyViewSet, basename='ref-currencies')
router.register(r'country-currency-map', RefCountryCurrencyMapViewSet, basename='ref-ccmap')
router.register(r'org-countries', OrgCountryViewSet, basename='org-countries')
router.register(r'org-currencies', OrgCurrencyViewSet, basename='org-currencies')
```

### 7. `apps/reference/services.py` — Auto-provisioning
```python
class ReferenceProvisioningService:
    @staticmethod
    def provision_org_defaults(organization, base_country_iso2=None, base_currency_code=None):
        """
        Auto-provision org country/currency during org setup.
        1. If base_country provided → enable it, mark default
        2. If base_currency provided → enable it, mark default
        3. If country has default_currency and no base_currency → auto-enable
        """
```

### 8. `apps/reference/admin.py` — Django Admin registration

### 9. `apps/reference/management/commands/seed_reference.py`
- Seeds ALL ~250 ISO 3166-1 countries with full enrichment
- Seeds ALL ~160 ISO 4217 currencies
- Seeds primary country→currency mappings
- Idempotent (get_or_create)

### 10. `apps/reference/seeders/countries.py` — Country data list
- All 250 ISO countries with `iso2`, `iso3`, `numeric_code`, `name`, `official_name`, `phone_code`, `region`, `subregion`, `default_currency_code`

### 11. `apps/reference/seeders/currencies.py` — Currency data list  
- All ~160 ISO 4217 currencies with `code`, `numeric_code`, `name`, `symbol`, `minor_unit`

### 12. `apps/reference/module.json`
```json
{
  "name": "reference",
  "version": "1.0.0",
  "description": "Global reference data: countries, currencies, and org activation",
  "dependencies": [],
  "events_produced": [],
  "events_consumed": [],
  "is_core": true
}
```

---

## 📋 Files to Modify

### 1. `erp/models.py` — Add FK fields to Organization
```python
# ADD to Organization model (lines ~131-178):
base_country = models.ForeignKey(
    'reference.Country', on_delete=models.SET_NULL, 
    null=True, blank=True, related_name='base_organizations',
    help_text='Base country for this organization'
)
# Keep existing base_currency FK for now (backward compat)
# In Phase 2, migrate to reference.Currency FK
```

### 2. `erp/management/commands/seed_core.py`  
- Replace inline country/currency seeding → call `seed_reference` or import from reference
- Keep backward compat: still seed the legacy `GlobalCurrency` and `Country` tables for existing FKs

### 3. `erp/urls.py`
- No changes needed! Auto-discovery handles `apps/reference/urls.py` via the dynamic module registration

### 4. `erp/views_org.py` — Organization provisioning
- After creating org, call `ReferenceProvisioningService.provision_org_defaults()`

### 5. `erp/serializers/core.py` — OrganizationSerializer
- Add `base_country` related fields to serializer output

---

## 🔄 Migration Strategy

### Step 1: Create new reference tables
```bash
python manage.py makemigrations reference
python manage.py migrate reference
```

### Step 2: Seed master data
```bash
python manage.py seed_reference
```

### Step 3: Add Organization.base_country FK
```bash
python manage.py makemigrations erp
python manage.py migrate erp
```

### Step 4: Backfill Organization.base_country from existing CharField
```python
# Data migration: match org.country text → ref_countries.name/iso2
```

### Step 5 (Phase 2 — NOT this phase):
- Migrate finance `Currency` to link to `ref_currencies`
- Migrate `Organization.base_currency` from `GlobalCurrency` → `ref_currencies`
- Deprecate legacy tables

---

## 📐 API Endpoints (Phase 1)

### Global Reference (SaaS Admin level)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/reference/countries/` | List all countries | Authenticated |
| `GET` | `/api/reference/countries/{id}/` | Country detail | Authenticated |
| `POST/PUT/DELETE` | `/api/reference/countries/` | CRUD | Staff only |
| `GET` | `/api/reference/currencies/` | List all currencies | Authenticated |
| `GET` | `/api/reference/currencies/{id}/` | Currency detail | Authenticated |
| `POST/PUT/DELETE` | `/api/reference/currencies/` | CRUD | Staff only |
| `GET` | `/api/reference/country-currency-map/` | List all mappings | Authenticated |

### Organization Activation (Tenant level)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/reference/org-countries/` | List org's enabled countries | Tenant |
| `POST` | `/api/reference/org-countries/` | Enable a country for org | Admin |
| `PATCH` | `/api/reference/org-countries/{id}/` | Update (set default, reorder) | Admin |
| `DELETE` | `/api/reference/org-countries/{id}/` | Disable country for org | Admin |
| `POST` | `/api/reference/org-countries/set-default/` | Set default country | Admin |
| `POST` | `/api/reference/org-countries/bulk-enable/` | Enable multiple | Admin |
| `GET` | `/api/reference/org-currencies/` | List org's enabled currencies | Tenant |
| `POST` | `/api/reference/org-currencies/` | Enable a currency for org | Admin |
| `PATCH` | `/api/reference/org-currencies/{id}/` | Update (default, reporting, etc.) | Admin |
| `DELETE` | `/api/reference/org-currencies/{id}/` | Disable currency for org | Admin |
| `POST` | `/api/reference/org-currencies/set-default/` | Set default currency | Admin |

---

## ✅ Architecture Compliance

| Check | Status |
|-------|--------|
| Org-scoped models inherit `TenantOwnedModel`? | ✅ `OrgCountry`, `OrgCurrency` |
| Org-scoped models include `AuditLogMixin`? | ✅ Both |
| No hardcoded values? | ✅ All data from seed scripts, configurable |
| No cross-module imports? | ✅ Self-contained module |
| RBAC checks? | ✅ Staff-only for SaaS CRUD, admin for org activation |
| Module boundaries respected? | ✅ Standalone `apps/reference/` |
| Validation script compatible? | ✅ Will pass `validate_architecture.py` |

---

## 🚫 What This Phase Does NOT Do (Deferred to Phase 2/3)

- ❌ Does NOT migrate finance `Currency` model (Phase 2)
- ❌ Does NOT migrate `Organization.base_currency` FK from `GlobalCurrency` → `ref_currencies` (Phase 2)
- ❌ Does NOT remove legacy `GlobalCurrency` or `Country` tables (Phase 2)
- ❌ Does NOT add exchange rate engine (Phase 3)
- ❌ Does NOT add `valid_from`/`valid_to` to `CountryCurrencyMap` (Phase 3)
- ❌ Does NOT add tax-country bindings (Phase 3)
- ❌ Does NOT migrate existing module references (CRM addresses, inventory country, etc.) — Phase 2

---

## 📊 Seed Data Summary

| Table | Records | Source |
|-------|---------|--------|
| `ref_countries` | ~250 | ISO 3166-1 complete list |
| `ref_currencies` | ~160 | ISO 4217 complete list |
| `ref_country_currency_map` | ~260 | Primary + secondary currency mappings |

---

## 🔐 Business Rules Enforced

1. **SaaS master data is read-only** for regular users
2. **One default country per org** — setting a new default un-defaults the previous
3. **One default currency per org** — same single-default rule
4. **Org can only activate from SaaS master list** — no manual creation
5. **During org provisioning** — base country/currency auto-enabled and marked default
6. **Default currency cannot be disabled** — must change default first

---

## ⏱️ Implementation Order

1. Create `apps/reference/` module skeleton (apps.py, __init__.py, module.json)
2. Create models.py (all 5 models)
3. Create seeders (countries.py, currencies.py)
4. Create management command (seed_reference)
5. Create serializers.py
6. Create views.py + urls.py
7. Add Organization.base_country FK to erp/models.py
8. Update seed_core.py to call reference seeder
9. Update Organization provisioning to auto-provision
10. Run migrations + seed
11. Validate architecture compliance

**Ready for implementation upon approval.**
