# 🏛️ Price Regulation System — Implementation Plan v2

> **Status:** REVIEWED — Gaps Fixed  
> **Module:** `apps/compliance/` (NEW standalone module)  
> **Priority:** High (compliance-critical, legal liability)  
> **Created:** 2026-03-24  
> **Review Score:** 9/10 → targeting 11/10  

---

## 1. Problem Statement

Some products have government-regulated prices (fixed, maximum, or minimum). Selling above the regulated price creates **legal liability**. The system must:

1. **Define** price regulations with full legal traceability (versioning, audit)
2. **Scope** regulations by country/region for multi-country operations
3. **Enforce** compliance at every sales touchpoint (POS, eCommerce, bulk updates)
4. **Alert** when violations occur and assign corrective tasks
5. **Auto-apply** regulations to new products matching criteria
6. **Prove** compliance during government inspections (audit trail)

---

## 2. Architecture — Module Isolation

### ❌ WRONG: Put in Inventory
### ✅ CORRECT: Standalone `apps/compliance/` module

```
apps/compliance/
├── models/
│   ├── regulation.py          # PriceRegulation + versions
│   ├── regulation_rule.py     # Auto-matching criteria  
│   ├── audit_log.py           # Legal audit trail
│   └── __init__.py
├── services/
│   ├── regulation_service.py  # Core compliance engine
│   ├── matching_service.py    # Auto-enrollment logic
│   └── score_service.py       # Dynamic product scores
├── views/
│   └── regulation_views.py    # API endpoints
├── serializers/
│   └── regulation_serializers.py
├── connectors/
│   └── compliance_connector.py  # ConnectorEngine capability
├── migrations/
├── apps.py
└── __init__.py
```

### ConnectorEngine Integration

```python
# Capability exposed:
"compliance.price.validate"

# Usage from POS:
result = connector.require(
    "compliance.price.validate",
    org_id=org.id,
    product_id=product.id,
    price=unit_price,
    source="pos",         # pos | product_save | bulk_import | group_sync
    scope="OFFICIAL",     # OFFICIAL | INTERNAL
)
# Returns: {compliant: bool, action: "ALLOW"|"BLOCK"|"CLAMP", 
#           regulated_price: Decimal, violation_amount: Decimal}

# Usage from Product save:
result = connector.require(
    "compliance.price.validate",
    org_id=org.id,
    product_id=product.id,
    price=new_selling_price,
    source="product_save",
    scope="BOTH",
)
```

**Benefits:**
- No direct dependency between POS/Inventory ↔ Compliance
- Modules stay isolated per TSFSYSTEM architecture
- Future: tax/discounts can reuse the capability

---

## 3. Data Model (ALL GAPS FIXED)

### Model 1: `PriceRegulation` (the decree itself — with versioning)

```python
class PriceRegulation(AuditLogMixin, TenantModel):
    """A government price regulation decree. Versioned for legal traceability."""
    
    REGULATION_TYPES = (
        ('FIXED', 'Fixed Price — cannot sell above or below'),
        ('MAX', 'Maximum Price — ceiling, cannot exceed'),
        ('MIN', 'Minimum Price — floor, cannot go below'),
        ('RANGE', 'Price Range — must stay within band'),
    )
    
    STATUS_CHOICES = (
        ('ACTIVE', 'Active — currently enforced'),
        ('EXPIRED', 'Expired — past expiry date'),
        ('SUSPENDED', 'Suspended — temporarily not enforced'),
        ('DRAFT', 'Draft — not yet active'),
    )
    
    SEVERITY_CHOICES = (
        ('BLOCKING', 'Blocking — cannot sell if violated'),
        ('WARNING', 'Warning — allow but log violation'),
    )
    
    SCOPE_CHOICES = (
        ('OFFICIAL', 'Official scope only'),
        ('INTERNAL', 'Internal scope only'),
        ('BOTH', 'Both official and internal'),
    )
    
    # ── Identity ──
    name = CharField(max_length=200)          # "Huile Locale 1L Price Cap"
    code = CharField(max_length=50)           # "REG-2026-042"
    description = TextField(blank=True)
    
    # ── Regulation Type & Prices ──
    regulation_type = CharField(choices=REGULATION_TYPES)
    fixed_price = DecimalField(max_digits=15, decimal_places=2, null=True)
    max_price = DecimalField(max_digits=15, decimal_places=2, null=True)
    min_price = DecimalField(max_digits=15, decimal_places=2, null=True)
    
    # ── GAP 3 FIX: Currency (MANDATORY) ──
    currency = ForeignKey('erp.Currency', on_delete=PROTECT)
    
    # ── GAP 4 FIX: Tolerance / Rounding ──
    tolerance = DecimalField(max_digits=10, decimal_places=2, default=0)
    # Example: MAX 800, tolerance 5 → allow up to 805
    # Prevents false violations from rounding (799.99, 800.01)
    
    # ── GAP 5 FIX: Scope ──
    scope = CharField(choices=SCOPE_CHOICES, default='BOTH')
    
    # ── Severity ──
    severity = CharField(choices=SEVERITY_CHOICES, default='BLOCKING')
    
    # ── GAP 6 FIX: Override Policy ──
    allow_override = BooleanField(default=False)
    override_requires_approval = BooleanField(default=True)
    # If allow_override=True + override_requires_approval=True
    #   → manager can override with PIN, logged, pending approval
    # If allow_override=True + override_requires_approval=False
    #   → manager can override with PIN, logged only
    # If allow_override=False → NO override possible
    
    # ── Auto-correction ──
    auto_correct = BooleanField(default=False)
    # If True: FIXED → force price, MAX → clamp to max, MIN → clamp to min
    # If False: just block or warn
    
    # ── Legal Reference ──
    reference = CharField(max_length=200)      # "Decree #2026-042"
    authority = CharField(max_length=200)      # "Ministry of Commerce"
    effective_date = DateField()
    expiry_date = DateField(null=True)         # null = indefinite
    
    # ── NEW: Country / Region Scoping ──
    country = ForeignKey('erp.Country', null=True, blank=True, on_delete=SET_NULL)
    # null = applies to ALL countries in the org
    region = CharField(max_length=100, blank=True)
    # Optional sub-country region (e.g., "Abidjan", "Zone CEMAC")
    # When set: regulation only applies to products/sales in that region
    
    # ── GAP 2 FIX: Versioning ──
    version = PositiveIntegerField(default=1)
    is_current = BooleanField(default=True)
    previous_version = ForeignKey('self', null=True, blank=True, 
                                  on_delete=SET_NULL, related_name='next_versions')
    # When government updates price 800 → 850:
    #   1. Old record: is_current=False (preserved for history)
    #   2. New record: version=2, is_current=True, previous_version=old
    #   3. Old sales keep reference to old regulation version
    
    # ── Status ──
    status = CharField(choices=STATUS_CHOICES, default='DRAFT')
    
    # ── Notes ──
    notes = TextField(blank=True)
    
    class Meta:
        db_table = 'compliance_price_regulation'
        constraints = [
            UniqueConstraint(
                fields=['code', 'version', 'organization'],
                name='unique_regulation_code_version_tenant'
            ),
        ]
        indexes = [
            models.Index(fields=['organization', 'status', 'is_current'],
                         name='regulation_active_current_idx'),
            models.Index(fields=['organization', 'country'],
                         name='regulation_country_idx'),
        ]
```

### Model 2: `RegulationRule` (auto-matching criteria)

```python
class RegulationRule(AuditLogMixin, TenantModel):
    """Criteria for auto-matching products to a regulation.
    Supports: category, country, brand, unit, size, parfum.
    Most-specific rule wins (priority + specificity score)."""
    
    regulation = ForeignKey(PriceRegulation, on_delete=CASCADE, related_name='rules')
    
    # ── Matching Criteria (all nullable = wildcard) ──
    category = ForeignKey('inventory.Category', null=True, blank=True, on_delete=SET_NULL)
    product_country = ForeignKey('erp.Country', null=True, blank=True, on_delete=SET_NULL)
    # Note: this is the product's origin country, NOT the regulation's jurisdiction country
    brands = ManyToManyField('inventory.Brand', blank=True)  # empty = any brand
    unit = ForeignKey('inventory.Unit', null=True, blank=True, on_delete=SET_NULL)
    parfum = ForeignKey('inventory.Parfum', null=True, blank=True, on_delete=SET_NULL)
    
    # ── Size Matching ──
    size_exact = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    size_min = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    size_max = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # ── Auto Actions ──
    auto_create_group = BooleanField(default=True)
    price_group = ForeignKey('inventory.ProductGroup', null=True, blank=True, on_delete=SET_NULL)
    
    # ── Priority (higher = checked first when same specificity) ──
    priority = IntegerField(default=0)
    
    class Meta:
        db_table = 'compliance_regulation_rule'
        ordering = ['-priority']
```

### Model 3: `RegulationAuditLog` (GAP 1 FIX — Legal Compliance)

```python
class RegulationAuditLog(TenantModel):
    """Immutable audit trail for government inspection.
    Records EVERY price change related to regulated products.
    NEVER delete or modify records."""
    
    ACTION_CHOICES = (
        ('VIOLATION_DETECTED', 'Violation detected'),
        ('AUTO_FIX', 'Auto-corrected to regulated price'),
        ('MANUAL_FIX', 'Manually fixed by user'),
        ('MANUAL_OVERRIDE', 'Manager override (with PIN)'),
        ('REGULATION_APPLIED', 'Regulation first applied to product'),
        ('REGULATION_REMOVED', 'Regulation removed from product'),
        ('REGULATION_UPDATED', 'Regulation price changed (new version)'),
        ('COMPLIANCE_ACHIEVED', 'Product now compliant'),
        ('POS_BLOCKED', 'POS sale blocked due to violation'),
        ('POS_CLAMPED', 'POS sale price auto-clamped'),
        ('SAVE_BLOCKED', 'Product save blocked due to violation'),
        ('SAVE_WARNING', 'Product saved with warning'),
        ('EXEMPTION_GRANTED', 'Product exempted from regulation'),
    )
    
    # ── What happened ──
    action = CharField(choices=ACTION_CHOICES, max_length=30)
    
    # ── Who ──
    user = ForeignKey('erp.User', null=True, on_delete=SET_NULL)
    
    # ── What product ──
    product = ForeignKey('inventory.Product', on_delete=CASCADE, related_name='+')
    product_sku = CharField(max_length=100)   # Denormalized for audit permanence
    product_name = CharField(max_length=300)  # Denormalized for audit permanence
    
    # ── What regulation ──
    regulation = ForeignKey(PriceRegulation, on_delete=CASCADE, related_name='+')
    regulation_code = CharField(max_length=50)  # Denormalized
    regulation_version = IntegerField()         # Which version was active
    
    # ── Price details ──
    old_price = DecimalField(max_digits=15, decimal_places=2, null=True)
    new_price = DecimalField(max_digits=15, decimal_places=2, null=True)
    regulated_price = DecimalField(max_digits=15, decimal_places=2)  # What the law says
    violation_amount = DecimalField(max_digits=15, decimal_places=2, null=True)
    currency = ForeignKey('erp.Currency', on_delete=PROTECT)
    
    # ── Context ──
    source = CharField(max_length=30)  # "pos", "product_save", "bulk_import", "group_sync"
    scope = CharField(max_length=10)   # "OFFICIAL", "INTERNAL", "BOTH"
    override_reason = TextField(blank=True)  # If manager overrode, why
    
    # ── Immutable timestamp ──
    timestamp = DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'compliance_regulation_audit_log'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['organization', 'product', '-timestamp'],
                         name='audit_product_time_idx'),
            models.Index(fields=['organization', 'action', '-timestamp'],
                         name='audit_action_time_idx'),
            models.Index(fields=['organization', 'regulation', '-timestamp'],
                         name='audit_regulation_time_idx'),
        ]
```

### Model 4: Product Model Additions

```python
# On existing Product model — add these fields:
price_regulation = ForeignKey(
    'compliance.PriceRegulation', null=True, blank=True,
    on_delete=SET_NULL, related_name='products'
)
regulation_status = CharField(
    max_length=20,
    choices=[
        ('COMPLIANT', 'Compliant'),
        ('VIOLATION', 'Price violates regulation'),
        ('NOT_REGULATED', 'Not regulated'),
        ('EXEMPT', 'Exempt from regulation'),
    ],
    default='NOT_REGULATED',
    db_index=True
)
regulation_violation_amount = DecimalField(
    max_digits=15, decimal_places=2, null=True, blank=True
)
regulation_checked_at = DateTimeField(null=True, blank=True)
```

---

## 4. Country / Region Scoping

### How Multi-Country Regulation Works

```
Organization: "TSF Group" (operates in 3 countries)
│
├── Country: Ivory Coast (XOF)
│   ├── REG-CI-2026-001: Huile 1L MAX 800 XOF
│   ├── REG-CI-2026-002: Sucre 1kg FIXED 600 XOF
│   └── REG-CI-2026-003: Riz 1kg MAX 450 XOF
│
├── Country: Senegal (XOF)
│   ├── REG-SN-2026-001: Huile 1L MAX 850 XOF  ← Different price!
│   └── REG-SN-2026-002: Sucre 1kg FIXED 650 XOF
│
└── Country: Cameroon (XAF)
    └── REG-CM-2026-001: Huile 1L MAX 900 XAF  ← Different currency!
```

### Matching Logic with Country/Region

```python
def validate_price(self, product, price, sale_country=None, sale_region=None):
    """
    Find applicable regulation considering:
    1. Product's own regulation (direct link)
    2. Rule-based match (category + size + country)
    3. Country/region of the SALE (not just product origin)
    """
    # Priority:
    # 1. Direct product.price_regulation (if set)
    # 2. RegulationRule match for sale_country
    # 3. RegulationRule match with country=NULL (global rule)
    
    regulations = PriceRegulation.objects.filter(
        organization=product.organization,
        status='ACTIVE',
        is_current=True,
    )
    
    # Filter by jurisdiction
    if sale_country:
        # Regulations for this specific country + global regulations
        regulations = regulations.filter(
            Q(country=sale_country) | Q(country__isnull=True)
        )
        if sale_region:
            regulations = regulations.filter(
                Q(region=sale_region) | Q(region='')
            )
    
    # Country-specific regulation takes priority over global
    # ...
```

### UI: Country Filter on Compliance Page

```
┌──────────────────────────────────────────────────────────────┐
│ 🏛️ Price Regulations                         [+ New Rule]   │
│ ────────────────────────────────────────────────────────────  │
│ Country: [🇨🇮 Ivory Coast ▾]  Region: [All ▾]              │
│ ────────────────────────────────────────────────────────────  │
│ [📋 Rules (5)] [📦 Products (47)] [⚠️ Violations (3)]      │
│ ────────────────────────────────────────────────────────────  │
│                                                              │
│ REG-CI-2026-001  Huile Locale 1L    MAX 800 XOF   🇨🇮 ACTIVE│
│ REG-CI-2026-002  Sucre Local 1kg    FIXED 600 XOF 🇨🇮 ACTIVE│
│ REG-CI-2026-003  Riz 1kg            MAX 450 XOF   🇨🇮 ACTIVE│
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Enforcement Matrix (FINAL — All Questions Answered)

| Context | Severity: BLOCKING | Severity: WARNING |
|---------|-------------------|-------------------|
| **POS Sale** | ❌ HARD BLOCK (cannot sell) | ⚠️ Allow + log + notification |
| **Product Save** | ⚠️ SOFT warn + allow save + flag | ⚠️ Allow + flag |
| **Bulk Import** | ⚠️ SOFT warn + flag all violations | ⚠️ Allow + report |
| **Group Sync** | ⚠️ SOFT validate against regulation | ⚠️ Allow + flag |

### Override Rules

| Setting | Behavior |
|---------|----------|
| `allow_override=False` | NO override possible. Period. |
| `allow_override=True` + `override_requires_approval=True` | Manager PIN + logged + pending approval from Compliance Officer |
| `allow_override=True` + `override_requires_approval=False` | Manager PIN + logged only |

### Auto-Correction

| `auto_correct=True` | Behavior |
|---------------------|----------|
| FIXED regulation | Force price to `fixed_price` automatically |
| MAX regulation | Clamp price to `max_price` if exceeded |
| MIN regulation | Clamp price to `min_price` if below |
| RANGE regulation | Clamp to nearest boundary |

---

## 6. Regulation vs ProductGroup — Relationship Clarified

> **IMPORTANT DECISION: Regulation ≠ Group Price**

| Concept | Purpose |
|---------|---------|
| **Regulation** | Legal CONSTRAINT (ceiling/floor/fixed) |
| **ProductGroup** | Pricing STRATEGY (unified price for similar products) |

**Correct logic:**
- Regulation sets the **boundary** (e.g., MAX 800)
- ProductGroup sets the **actual price** (e.g., 750) within that boundary
- Group price update is VALIDATED against regulation
- Regulation does NOT force group price — it only blocks violations

```
Regulation: MAX 800
ProductGroup price: 750 ✅ (under max)
ProductGroup price: 850 ❌ BLOCKED (exceeds max)
```

---

## 7. Business Intelligence — Compliance Dashboard

### Key Metrics (computed dynamically)

```
┌──────────────────────────────────────────────────────────────┐
│ 📊 Compliance Overview                                       │
│                                                              │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────────────┐    │
│  │ 97%    │  │ 3      │  │ 47     │  │ -120,000 FCFA  │    │
│  │Compliance│ │Violations│ │Regulated│ │Lost Revenue    │    │
│  │Rate     │  │Active  │  │Products│  │Due to Regulation│   │
│  └────────┘  └────────┘  └────────┘  └────────────────┘    │
│                                                              │
│  📉 Most Violated Category: Sugar (2 violations)            │
│  📅 Next Expiring Rule: REG-2026-003 in 45 days            │
│  🔄 Last Bulk Check: 2 hours ago                            │
└──────────────────────────────────────────────────────────────┘
```

### Batch Fix Tool

```
[ 🔧 Fix All Violations ]
→ Auto-corrects all COMPLIANT products to regulated prices
→ Shows preview: "3 products will be adjusted"
→ Creates bulk audit log entries
→ Requires Compliance Officer role
```

---

## 8. Phased Implementation (REVISED)

### Phase 1: Foundation (apps/compliance + models + basic UI)
> **Effort:** ⭐⭐⭐  

| Step | Task | Priority |
|------|------|----------|
| 1.1 | Create `apps/compliance/` module structure | P0 |
| 1.2 | `PriceRegulation` model with versioning, currency, tolerance, scope | P0 |
| 1.3 | `RegulationRule` model with all matching criteria | P0 |
| 1.4 | `RegulationAuditLog` model (immutable) | P0 |
| 1.5 | Add regulation fields to Product model + migration | P0 |
| 1.6 | `PriceRegulationService` — core compliance checks | P0 |
| 1.7 | Register compliance connector capability | P0 |
| 1.8 | Compliance page UI — Rules list + products + violations tabs | P1 |
| 1.9 | Regulation create/edit form with all fields | P1 |

### Phase 2: Enforcement Layer
> **Effort:** ⭐⭐  
> **Depends on:** Phase 1

| Step | Task | Priority |
|------|------|----------|
| 2.1 | ConnectorEngine capability: `compliance.price.validate` | P0 |
| 2.2 | Product save validation (via connector) | P0 |
| 2.3 | POS sale enforcement (via connector) | P0 |
| 2.4 | Audit log on every enforcement action | P0 |
| 2.5 | Manager override flow (PIN + approval) | P1 |
| 2.6 | Auto-correction mode | P1 |
| 2.7 | Notification on violation | P1 |

### Phase 3: Auto-Matching Engine  
> **Effort:** ⭐⭐⭐⭐  
> **Depends on:** Phase 1 + 2

| Step | Task | Priority |
|------|------|----------|
| 3.1 | `MatchingService` — specificity scoring engine | P0 |
| 3.2 | Product post_save signal → auto-match | P0 |
| 3.3 | Bulk re-match command (when rule changes) | P1 |
| 3.4 | Auto-enroll into ProductGroup | P1 |
| 3.5 | Match preview UI (show what a rule will match before saving) | P2 |

### Phase 4: Dynamic Product Scores
> **Effort:** ⭐⭐⭐  
> **Depends on:** POS discount reason tagging

| Step | Task | Priority |
|------|------|----------|
| 4.1 | Add `discount_reason` to POS sale line model | P0 |
| 4.2 | `ProductScoreService` — Financial Score (live) | P0 |
| 4.3 | `ProductScoreService` — Adjustment Score (live) | P0 |
| 4.4 | `ProductScoreService` — Profitable Score (live) | P0 |
| 4.5 | Score columns in product list (configurable period: 30/90/365d) | P1 |
| 4.6 | Score-based product list filters | P2 |

### Phase 5: Advanced (Future)
> **Effort:** ⭐⭐⭐⭐⭐

| Step | Task | Priority |
|------|------|----------|
| 5.1 | Government API sync (auto-import regulations) | P3 |
| 5.2 | Predictive violation alerts (alert BEFORE it happens) | P3 |
| 5.3 | Supplier purchase price control (buy price vs regulated resale) | P2 |
| 5.4 | Compliance export report (for government inspection) | P1 |

---

## 9. Dependencies

| Dependency | Status | Needed For |
|------------|--------|------------|
| ProductGroup system | ✅ Exists | Phase 1 (group-level regulation) |
| Product model (size, unit, parfum) | ✅ Exists | Phase 3 (auto-matching) |
| ConnectorEngine | ✅ Exists | Phase 2 (enforcement routing) |
| Currency model | ✅ Exists | Phase 1 (currency on regulation) |
| Country model | ✅ Exists | Phase 1 (country scoping) |
| POS sale service | ✅ Exists | Phase 2B (POS enforcement) |
| Discount reason on sale line | ❌ Not yet | Phase 4 (Financial Score) |
| Task/notification system | ❌ Not yet | Phase 2 (auto-tasks) |
| StockAdjustment model | ✅ Exists | Phase 4 (Adjustment Score) |

---

## 10. Decisions Made (from review)

| Question | Decision |
|----------|----------|
| Hard or soft enforcement? | **POS=HARD (BLOCKING), Product save=SOFT, Bulk=SOFT** |
| Manager override? | **YES with PIN, logged, optional approval workflow** |
| Expired regulations? | **AUTO-deactivate + notification 30 days before** |
| Group vs Regulation? | **Regulation=constraint, Group=strategy. Independent.** |
| Role access? | **Compliance Officer + Admin only** |
| Score time period? | **Configurable, default 90 days** |
| Currency? | **MUST be explicit on every regulation (multi-currency)** |
| Country scoping? | **Per-regulation country + optional region. NULL=global.** |
| Where to put code? | **`apps/compliance/` — standalone module via ConnectorEngine** |
| Tolerance? | **Configurable per regulation (default 0)** |
| Scope? | **OFFICIAL / INTERNAL / BOTH — per regulation** |
