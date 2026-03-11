"""
CRM Module Models
Extracted from Kernel (erp/models.py) → Module Layer (apps/crm/models.py)

Enterprise Hardening (v1.2.0):
- Contact Lifecycle: DRAFT → ACTIVE → ON_HOLD → BLOCKED → ARCHIVED → MERGED
- Dual-account linking for BOTH contacts (AR + AP)
- Audit trail for sensitive field changes
- Duplicate detection metadata
- Validation invariants
"""
from django.db import models
from django.core.exceptions import ValidationError
from django.conf import settings
from decimal import Decimal
import warnings
from django.utils.translation import gettext_lazy as _
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.config import get_config


class ContactTag(AuditLogMixin, TenantOwnedModel):
    """User-defined contact categories: Wholesale, Retail, Family, Friends, VIP, etc."""
    SCOPE_TYPES = (
        ('CUSTOMER', 'Customer'),
        ('SUPPLIER', 'Supplier'),
        ('BOTH', 'Customer & Supplier'),
        ('LEAD', 'Lead'),
        ('CREDITOR', 'Creditor'),
        ('DEBTOR', 'Debtor'),
        ('CONTACT', 'Contact'),
        ('SERVICE', 'Service Provider'),
    )
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='children', help_text='Parent category for hierarchical grouping'
    )
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default='#6366F1', help_text='Hex color for the badge')
    icon = models.CharField(max_length=50, null=True, blank=True, help_text='Lucide icon name')
    description = models.TextField(null=True, blank=True)
    contact_type = models.CharField(
        max_length=20, choices=SCOPE_TYPES, null=True, blank=True,
        help_text='Scope this category to a specific contact type. Null = applies to all types.'
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'contact_tag'
        ordering = ['sort_order', 'name']
        unique_together = ['tenant', 'name']

    def __str__(self):
        return self.name


def contact_photo_path(instance, filename):
    """
    Isolated storage path for contact photos.
    Format: org_<id>/crm/contacts/<id>/<filename>
    """
    import os
    ext = os.path.splitext(filename)[1]
    # We use a clean name to maintain isolation and predictability
    return f"org_{instance.tenant_id}/crm/contacts/p_{instance.id}{ext}"


class Contact(AuditLogMixin, TenantOwnedModel):
    TYPES = (
        ('SUPPLIER', 'Supplier'),
        ('CUSTOMER', 'Customer'),
        ('BOTH', 'Customer & Supplier'),
        ('LEAD', 'Lead'),
        ('CREDITOR', 'Creditor'),
        ('DEBTOR', 'Debtor'),
        ('CONTACT', 'Contact'),
        ('SERVICE', 'Service Provider'),
    )
    ENTITY_TYPES = (
        ('INDIVIDUAL', 'Individual'),
        ('BUSINESS', 'Business / Company'),
    )
    SUPPLIER_CATEGORIES = (
        ('REGULAR', 'Regular'),
        ('DEPOT_VENTE', 'Depot Vente (Consignment)'),
        ('MIXED', 'Mixed'),
    )
    CUSTOMER_TIERS = (
        ('STANDARD', 'Standard'),
        ('VIP', 'VIP'),
        ('WHOLESALE', 'Wholesale'),
        ('RETAIL', 'Retail'),
    )

    # ── Enterprise Lifecycle States ────────────────────────────
    STATUSES = (
        ('DRAFT',    'Draft — incomplete, not commercially usable'),
        ('ACTIVE',   'Active — fully operational'),
        ('ON_HOLD',  'On Hold — temporarily paused, pending review'),
        ('BLOCKED',  'Blocked — risk/compliance block, no new transactions'),
        ('ARCHIVED', 'Archived — historically preserved, read-only'),
        ('MERGED',   'Merged — absorbed into another master contact'),
    )
    COMMERCIAL_STATUSES = (
        ('NORMAL',          'Normal'),
        ('CREDIT_HOLD',     'Credit Hold — no new credit sales'),
        ('NO_NEW_SALES',    'No New Sales — blocked from sales transactions'),
        ('NO_NEW_PURCHASES','No New Purchases — blocked from purchase transactions'),
        ('MANUAL_REVIEW',   'Manual Review — requires admin approval for transactions'),
    )

    @property
    def TRANSACTIONAL_TYPES(self):
        """Transactional types that require COA linkage and active status"""
        return get_config('crm_transactional_types', default={'CUSTOMER', 'SUPPLIER', 'BOTH', 'SERVICE', 'CREDITOR', 'DEBTOR'})

    @property
    def COA_MAPPING(self):
        """COA Mapping: which posting rule path resolves each type's parent account"""
        return get_config('crm_coa_mapping', default={
            'CUSTOMER': ('automation', 'customerRoot', 'sales',     'receivable', 'RECEIVABLE'),
            'SUPPLIER': ('automation', 'supplierRoot', 'purchases', 'payable',    'PAYABLE'),
            'BOTH':     None,
            'SERVICE':  ('automation', 'serviceRoot',  'purchases', 'payable',    'PAYABLE'),
            'CREDITOR': ('automation', 'supplierRoot', 'purchases', 'payable',    'PAYABLE'),
            'DEBTOR':   ('automation', 'customerRoot', 'sales',     'receivable', 'RECEIVABLE'),
            'LEAD':     None,
            'CONTACT':  None,
        })

    type = models.CharField(max_length=20, choices=TYPES)
    entity_type = models.CharField(
        max_length=20, choices=ENTITY_TYPES, default='INDIVIDUAL',
        help_text='Individual person or Business/Company entity'
    )
    name = models.CharField(max_length=255)
    photo = models.ImageField(upload_to=contact_photo_path, null=True, blank=True)
    company_name = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    vat_id = models.CharField(max_length=100, null=True, blank=True)
    balance = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='DEPRECATED: use current_balance (finance-derived). Kept for backward compat only.'
    )
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'))
    # Decoupled from finance module — uses IntegerField to avoid hard dependency
    linked_account_id = models.IntegerField(
        null=True, blank=True, db_column='linked_account_id',
        help_text='Primary COA sub-account (AR for customers, AP for suppliers, AR for BOTH)'
    )
    linked_payable_account_id = models.IntegerField(
        null=True, blank=True,
        help_text='Secondary AP sub-account for BOTH contacts. Only populated when type=BOTH.'
    )
    home_site = models.ForeignKey('inventory.Warehouse', on_delete=models.SET_NULL, null=True, blank=True)

    # ── External Provider Integration ──
    whatsapp_group_id = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='WhatsApp Group ID (if you want notifications sent to a shared group instead of direct message)'
    )

    # Supplier-specific fields
    supplier_category = models.CharField(
        max_length=20, choices=SUPPLIER_CATEGORIES, default='REGULAR',
        null=True, blank=True,
        help_text='Supplier sourcing strategy: Regular, Consignment (Depot Vente), or Mixed'
    )

    # Customer-specific fields
    customer_type = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='DEPRECATED: Legacy field. Use customer_tier instead.'
    )
    customer_tier = models.CharField(
        max_length=20, choices=CUSTOMER_TIERS, default='STANDARD',
        null=True, blank=True,
        help_text='Client pricing tier: Standard, VIP, Wholesale, Retail'
    )
    loyalty_points = models.IntegerField(default=0, help_text='Accumulated loyalty points')
    home_zone = models.ForeignKey(
        'pos.DeliveryZone',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='clients',
        help_text='Default delivery zone for this client (auto-selected in POS)'
    )
    wallet_balance = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Customer wallet balance from stored change or top-ups'
    )

    # ── Customer Analytics (auto-computed) ─────────────────────
    first_purchase_date = models.DateTimeField(null=True, blank=True)
    last_purchase_date = models.DateTimeField(null=True, blank=True)
    total_orders = models.IntegerField(default=0, help_text='Total completed orders')
    lifetime_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Total revenue from this customer'
    )
    average_order_value = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Average order value'
    )

    # ── Supplier Performance: OBJECTIVE KPIs (auto-derived from POs) ──
    # These fields are automatically updated when POs are received/completed.
    # They form the basis of the objective scorecard (§24).
    supplier_total_orders = models.IntegerField(
        default=0,
        help_text='[OBJECTIVE] Total POs placed with this supplier'
    )
    on_time_deliveries = models.IntegerField(
        default=0,
        help_text='[OBJECTIVE] Deliveries received on or before expected date'
    )
    late_deliveries = models.IntegerField(
        default=0,
        help_text='[OBJECTIVE] Deliveries received after expected date'
    )
    total_purchase_amount = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='[OBJECTIVE] Total value of POs placed with this supplier'
    )
    avg_lead_time_days = models.DecimalField(
        max_digits=6, decimal_places=1, default=Decimal('0.0'),
        help_text='[OBJECTIVE] Average days from PO to delivery'
    )

    # ── Supplier Performance: SUBJECTIVE Ratings (manual human input) ──
    # These are entered manually by procurement/operations staff.
    # They form the basis of the subjective scorecard (§24).
    quality_rating = models.DecimalField(
        max_digits=3, decimal_places=1, default=Decimal('0.0'),
        help_text='[SUBJECTIVE] Manual quality assessment (1-5)'
    )
    delivery_rating = models.DecimalField(
        max_digits=3, decimal_places=1, default=Decimal('0.0'),
        help_text='[SUBJECTIVE] Manual delivery reliability impression (1-5)'
    )
    pricing_rating = models.DecimalField(
        max_digits=3, decimal_places=1, default=Decimal('0.0'),
        help_text='[SUBJECTIVE] Manual pricing competitiveness rating (1-5)'
    )
    service_rating = models.DecimalField(
        max_digits=3, decimal_places=1, default=Decimal('0.0'),
        help_text='[SUBJECTIVE] Manual communication/service quality (1-5)'
    )
    total_ratings = models.IntegerField(
        default=0,
        help_text='[SUBJECTIVE] Number of manual ratings submitted'
    )

    # ── Supplier Performance: COMPOSITE Score ──────────────────────
    overall_rating = models.DecimalField(
        max_digits=3, decimal_places=1, default=Decimal('0.0'),
        help_text='[COMPOSITE] Weighted average of subjective ratings (1-5)'
    )

    # ── EU Compliance ──────────────────────────────────────────
    is_eu_supplier = models.BooleanField(default=False)
    vat_number_eu = models.CharField(max_length=50, null=True, blank=True)
    country_code = models.CharField(
        max_length=2, null=True, blank=True,
        help_text='ISO 3166-1 alpha-2 country code (e.g. FR, US, CI)'
    )

    # ── Financial Extended ─────────────────────────────────────
    opening_balance = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Starting balance when contact was created'
    )
    current_balance = models.DecimalField(
        max_digits=15, decimal_places=2, default=Decimal('0.00'),
        help_text='Current running balance (auto-computed)'
    )
    DEFAULT_COST_BASES = (('HT', 'Hors Taxe'), ('TTC', 'Toutes Taxes Comprises'))
    default_cost_basis = models.CharField(
        max_length=3, choices=DEFAULT_COST_BASES, default='HT',
        null=True, blank=True,
        help_text='Default pricing basis for this supplier'
    )

    # Financial / Payment
    payment_terms_days = models.IntegerField(
        default=0, help_text='Default payment terms in days (0 = immediate)'
    )
    preferred_payment_method = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='Preferred method: CASH, BANK, CHECK, MOBILE_MONEY, etc.'
    )

    # Tax
    airsi_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    is_airsi_subject = models.BooleanField(default=False)

    # ── Compliance Cache (11/10 Enterprise Optimization) ───────
    compliance_status = models.CharField(
        max_length=30,
        choices=(
            ('COMPLIANT',    'Compliant'),
            ('MISSING_DOC',  'Missing Required Documents'),
            ('EXPIRED_DOC',  'Expired Documents'),
            ('EXPIRING_SOON','Expiring Soon (Warning)'),
            ('BLOCKED',      'Manually Blocked'),
            ('UNVERIFIED',   'Unverified Documents'),
        ),
        default='COMPLIANT'
    )
    compliance_score = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal('100.00'),
        help_text='Overall compliance health score (0-100)'
    )
    compliance_last_checked = models.DateTimeField(null=True, blank=True)
    compliance_next_expiry = models.DateField(null=True, blank=True)
    
    compliance_risk_level = models.CharField(
        max_length=20,
        choices=(('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')),
        default='LOW'
    )

    # ── Interaction & Relationship Cache (Relationship Management Engine) ──
    last_interaction_at = models.DateTimeField(null=True, blank=True)
    last_call_at = models.DateTimeField(null=True, blank=True)
    last_visit_at = models.DateTimeField(null=True, blank=True)
    last_order_at = models.DateTimeField(null=True, blank=True)
    
    next_scheduled_activity_at = models.DateTimeField(null=True, blank=True)
    next_scheduled_activity_type = models.CharField(max_length=50, null=True, blank=True)
    
    assigned_owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='assigned_contacts',
        help_text='The primary user responsible for this contact'
    )
    
    interaction_score = models.IntegerField(default=0, help_text='Computed score based on interaction frequency and outcome')
    
    followup_status = models.CharField(
        max_length=20,
        choices=(
            ('ON_TRACK', 'On Track'),
            ('DUE_SOON', 'Follow-up Due Soon'),
            ('OVERDUE',  'Follow-up Overdue'),
            ('DORMANT',  'Dormant (No interaction > 30d)'),
            ('NO_OWNER', 'No Owner Assigned'),
        ),
        default='ON_TRACK'
    )

    # ── Supplier VAT Regime (Component 1) ─────────────────────────────
    SUPPLIER_VAT_REGIME_CHOICES = (
        ('ASSUJETTI',     'Assujetti TVA — issues official TVA invoices (HT + TVA)'),
        ('NON_ASSUJETTI', 'Non-assujetti — issues simple receipts (no TVA breakdown)'),
        ('FOREIGN',       'Foreign supplier — reverse charge may apply'),
    )
    supplier_vat_regime = models.CharField(
        max_length=20,
        choices=SUPPLIER_VAT_REGIME_CHOICES,
        default='ASSUJETTI',
        null=True, blank=True,
        help_text='Tax regime of this supplier — determines whether VAT appears on their invoices'
    )

    # ── B2B / B2C Classification ──────────────────────────────────
    # DEPRECATED since v1.2.0 — Replaced by tax_profile_id + commercial_category
    # Kept for backward compatibility. Will be removed in v2.0.
    # New code should use: contact.tax_profile_id for fiscal behavior.
    CLIENT_TYPE_CHOICES = (
        ('B2B', 'Business (B2B) — Can receive TVA invoices'),
        ('B2C', 'Individual (B2C) — Receives simple receipts only'),
        ('UNKNOWN', 'Unknown — Not yet classified'),
    )
    client_type = models.CharField(
        max_length=10,
        choices=CLIENT_TYPE_CHOICES,
        default='UNKNOWN',
        null=True, blank=True,
        help_text='DEPRECATED v1.2.0: Use tax_profile_id + commercial_category instead. '
                  'This field will be removed in v2.0.'
    )

    @property
    def client_type_value(self):
        """Backward-compatible accessor with deprecation warning."""
        warnings.warn(
            'Contact.client_type is deprecated. Use tax_profile_id + commercial_category.',
            DeprecationWarning, stacklevel=2,
        )
        return self.client_type

    # ── Universal Tax Profile (new engine) ────────────────────────────
    COMMERCIAL_CATEGORY_CHOICES = (
        ('B2B',               'B2B — Company/Professional (NCC)'),
        ('B2F',               'B2F — Foreign / International'),
        ('B2G',               'B2G — Government / Institutional'),
        ('B2C',               'B2C — Individual / Particular'),
        ('NORMAL',            'Normal / Standard'),
        ('RETAIL',            'Retail Merchant'),
        ('WHOLESALE',         'Wholesale Merchant'),
        ('MICRO',             'Micro / Non-assujetti'),
        ('EXPORT',            'Export Account'),
    )
    commercial_category = models.CharField(
        max_length=20,
        choices=COMMERCIAL_CATEGORY_CHOICES,
        default='NORMAL',
        null=True, blank=True,
        help_text='Commercial label only — NO fiscal effect. Tax behavior comes from tax_profile_id.'
    )

    # ── West African / Ivory Coast Compliance ───────────────
    # These fields are mapped to local requirements (NCC, RCCM, DFE)
    tax_id = models.CharField(
        max_length=100, null=True, blank=True,
        db_column='tax_id',
        help_text='Official Tax Register Number (e.g., NCC in Ivory Coast)'
    )
    reg_number = models.CharField(
        max_length=100, null=True, blank=True,
        db_column='reg_number',
        help_text='Commercial Register Number (e.g., RCCM / Registre de Commerce)'
    )
    dfe_number = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Electronic Invoicing ID / DFE Number'
    )

    # Exoneration Tracking
    is_vat_exonerated = models.BooleanField(
        default=False,
        help_text='Explicit VAT Exoneration (Certificat d\'exonération TVA)'
    )
    vat_exoneration_expiry = models.DateField(
        null=True, blank=True,
        help_text='Expiry date of TVA Exoneration certificate'
    )
    is_airsi_exonerated = models.BooleanField(
        default=False,
        help_text='Explicit AIRSI Exoneration (No withholding tax)'
    )
    airsi_exoneration_expiry = models.DateField(
        null=True, blank=True,
        help_text='Expiry date of AIRSI Exoneration certificate'
    )
    tax_profile_id = models.IntegerField(
        null=True, blank=True,
        db_column='tax_profile_id',
        help_text='FK to CounterpartyTaxProfile (IntegerField avoids circular import)'
    )

    # Tags (user-defined categories)
    tags = models.ManyToManyField(
        'ContactTag', blank=True, related_name='contacts',
        help_text='User-defined categories: Wholesale, Retail, Family, VIP, etc.'
    )

    # Metadata
    notes = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True, help_text='Deactivate to hide without deleting')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    # ── Enterprise Lifecycle Fields ────────────────────────────
    status = models.CharField(
        max_length=20, choices=STATUSES, default='ACTIVE',
        help_text='Lifecycle status governing what operations are allowed'
    )
    commercial_status = models.CharField(
        max_length=20, choices=COMMERCIAL_STATUSES, default='NORMAL',
        help_text='Operational status affecting commercial transactions'
    )

    # Blocked metadata
    blocked_reason = models.TextField(null=True, blank=True, help_text='Reason for blocking')
    blocked_at = models.DateTimeField(null=True, blank=True)
    blocked_by = models.IntegerField(null=True, blank=True, help_text='User ID who blocked')

    # Archived metadata
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.IntegerField(null=True, blank=True, help_text='User ID who archived')

    # Merge metadata
    merged_into_contact_id = models.IntegerField(
        null=True, blank=True,
        help_text='If MERGED, the surviving master contact ID'
    )
    merge_reason = models.TextField(null=True, blank=True)

    # ── Finance Link Status ───────────────────────────────────
    FINANCE_LINK_STATUSES = (
        ('LINKED',   'Successfully linked to COA'),
        ('PENDING',  'Pending — finance service was unavailable'),
        ('FAILED',   'Failed — posting rules misconfigured'),
        ('N_A',      'Not applicable (LEAD/CONTACT)'),
    )
    finance_link_status = models.CharField(
        max_length=10, choices=FINANCE_LINK_STATUSES, default='N_A',
        help_text='Status of COA account linkage'
    )

    class Meta:
        db_table = 'contact'
        indexes = [
            models.Index(fields=['tenant', 'type'], name='idx_contact_tenant_type'),
            models.Index(fields=['tenant', 'status'], name='idx_contact_tenant_status'),
            models.Index(fields=['tenant', 'email'], name='idx_contact_tenant_email'),
            models.Index(fields=['tenant', 'phone'], name='idx_contact_tenant_phone'),
            models.Index(fields=['tenant', 'vat_id'], name='idx_contact_tenant_vat'),
            models.Index(fields=['tenant', 'entity_type'], name='idx_contact_tenant_entity'),
        ]

    def __str__(self):
        return f"{self.name} ({self.type})"

    def recalculate_analytics(self):
        """Recalculate customer analytics from order history."""
        if self.total_orders > 0:
            self.average_order_value = self.lifetime_value / self.total_orders
        else:
            self.average_order_value = Decimal('0.00')

    def recalculate_supplier_rating(self):
        """Recalculate overall supplier rating from individual subjective ratings."""
        ratings = [self.quality_rating, self.delivery_rating, self.pricing_rating, self.service_rating]
        non_zero = [r for r in ratings if r > 0]
        if non_zero:
            self.overall_rating = sum(non_zero) / len(non_zero)
        else:
            self.overall_rating = Decimal('0.0')

    # ── Supplier Scorecard (§24 — Objective vs Subjective Split) ──

    @property
    def objective_score(self):
        """
        Auto-derived supply reliability score (0-100) based on delivery data.
        Weights: on-time rate 60%, lead time consistency 40%.
        """
        total_deliveries = self.on_time_deliveries + self.late_deliveries
        if total_deliveries == 0:
            return None  # Insufficient data
        on_time_pct = (self.on_time_deliveries / total_deliveries) * 100
        # Lead time penalty: ideal is <7 days; penalize above 14+
        lead_time = float(self.avg_lead_time_days)
        if lead_time <= 7:
            lead_score = 100
        elif lead_time <= 14:
            lead_score = 100 - ((lead_time - 7) * (50 / 7))
        else:
            lead_score = max(0, 50 - ((lead_time - 14) * 2))

        return round(on_time_pct * 0.6 + lead_score * 0.4, 1)

    @property
    def subjective_score(self):
        """
        Average of manual ratings (1-5), scaled to 0-100.
        Returns None if no ratings submitted.
        """
        if self.total_ratings == 0:
            return None
        scores = [
            float(self.quality_rating), float(self.delivery_rating),
            float(self.pricing_rating), float(self.service_rating),
        ]
        non_zero = [s for s in scores if s > 0]
        if not non_zero:
            return None
        return round((sum(non_zero) / len(non_zero)) * 20, 1)  # Scale 1-5 → 0-100

    @property
    def composite_score(self):
        """
        Combined supplier score: 50% objective + 50% subjective.
        Falls back to whichever is available if only one exists.
        """
        obj = self.objective_score
        subj = self.subjective_score
        if obj is not None and subj is not None:
            return round(obj * 0.5 + subj * 0.5, 1)
        return obj or subj

    @property
    def supplier_scorecard(self):
        """Full structured scorecard per §24."""
        total_deliveries = self.on_time_deliveries + self.late_deliveries
        return {
            'objective': {
                'score': self.objective_score,
                'total_orders': self.supplier_total_orders,
                'total_deliveries': total_deliveries,
                'on_time_deliveries': self.on_time_deliveries,
                'late_deliveries': self.late_deliveries,
                'on_time_rate': round((self.on_time_deliveries / total_deliveries * 100), 1) if total_deliveries else None,
                'avg_lead_time_days': float(self.avg_lead_time_days),
                'total_purchase_amount': float(self.total_purchase_amount),
                'data_source': 'PO/Receipt auto-computed',
            },
            'subjective': {
                'score': self.subjective_score,
                'quality_rating': float(self.quality_rating),
                'delivery_rating': float(self.delivery_rating),
                'pricing_rating': float(self.pricing_rating),
                'service_rating': float(self.service_rating),
                'total_ratings': self.total_ratings,
                'overall_rating': float(self.overall_rating),
                'data_source': 'Manual staff input',
            },
            'composite_score': self.composite_score,
        }

    # ── Lifecycle Helpers ──────────────────────────────────────

    @property
    def is_transactional(self):
        """Can this contact participate in commercial transactions?"""
        return (
            self.status == 'ACTIVE' and
            self.commercial_status == 'NORMAL' and
            self.is_active
        )

    @property
    def is_operable(self):
        """Is this contact in a state that allows operations (not archived/merged)?"""
        return self.status in ('DRAFT', 'ACTIVE', 'ON_HOLD', 'BLOCKED')

    @property
    def can_sell_to(self):
        """Can we create new sales for this contact?"""
        return (
            self.is_transactional and
            self.type in ('CUSTOMER', 'BOTH', 'DEBTOR') and
            self.commercial_status not in ('NO_NEW_SALES', 'CREDIT_HOLD', 'MANUAL_REVIEW')
        )

    @property
    def can_purchase_from(self):
        """Can we create new purchases from this contact?"""
        return (
            self.is_transactional and
            self.type in ('SUPPLIER', 'BOTH', 'SERVICE', 'CREDITOR') and
            self.commercial_status not in ('NO_NEW_PURCHASES', 'MANUAL_REVIEW')
        )

    def clean(self):
        """Model-level validation invariants."""
        errors = {}

        # credit_limit >= 0
        if self.credit_limit is not None and self.credit_limit < 0:
            errors['credit_limit'] = 'Credit limit cannot be negative.'

        # payment_terms_days >= 0
        if self.payment_terms_days is not None and self.payment_terms_days < 0:
            errors['payment_terms_days'] = 'Payment terms cannot be negative.'

        # wallet_balance >= 0
        if self.wallet_balance is not None and self.wallet_balance < 0:
            errors['wallet_balance'] = 'Wallet balance cannot be negative.'

        # LEAD/CONTACT should not have linked_account_id
        if self.type in ('LEAD', 'CONTACT') and self.linked_account_id:
            errors['linked_account_id'] = f'{self.type} contacts should not have linked finance accounts.'

        # linked_payable_account_id only for BOTH
        if self.linked_payable_account_id and self.type != 'BOTH':
            errors['linked_payable_account_id'] = 'Secondary AP account only applies to BOTH contacts.'

        # MERGED must have merged_into_contact_id
        if self.status == 'MERGED' and not self.merged_into_contact_id:
            errors['merged_into_contact_id'] = 'Merged contacts must reference the surviving master record.'

        # BLOCKED must have reason
        if self.status == 'BLOCKED' and not self.blocked_reason:
            errors['blocked_reason'] = 'Blocked contacts must have a reason documented.'

        if errors:
            raise ValidationError(errors)


class ContactPerson(AuditLogMixin, TenantOwnedModel):
    """
    People within a Business contact — the Contact Book.
    Each person has a role (CEO, Accountant, Sales Rep, etc.)
    Used for: PO routing, invoice sending, WhatsApp notifications.
    """
    ROLES = (
        ('PRIMARY',     'Primary Contact'),
        ('CEO',         'CEO / Director'),
        ('MANAGER',     'Manager'),
        ('ACCOUNTANT',  'Accountant / Finance'),
        ('SALES',       'Sales Representative'),
        ('PURCHASING',  'Purchasing / Procurement'),
        ('LOGISTICS',   'Logistics / Delivery'),
        ('TECHNICAL',   'Technical / IT'),
        ('LEGAL',       'Legal / Compliance'),
        ('OTHER',       'Other'),
    )
    contact = models.ForeignKey(
        Contact, on_delete=models.CASCADE,
        related_name='people',
        help_text='Parent business contact'
    )
    name = models.CharField(max_length=255, help_text='Full name of the person')
    role = models.CharField(
        max_length=20, choices=ROLES, default='OTHER',
        help_text='Role within the organization'
    )
    department = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Department: Finance, IT, Operations, etc.'
    )
    phone = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    whatsapp = models.CharField(
        max_length=50, null=True, blank=True,
        help_text='WhatsApp number (for direct notifications)'
    )
    is_primary = models.BooleanField(
        default=False,
        help_text='Is this the main point of contact for this business?'
    )
    notes = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)

    class Meta:
        db_table = 'contact_person'
        ordering = ['-is_primary', 'name']

    def __str__(self):
        return f"{self.name} ({self.get_role_display()}) @ {self.contact.name}"


class ContactAuditLog(AuditLogMixin, TenantOwnedModel):
    """
    Immutable, append-only audit trail for sensitive Contact field changes.

    Every mutation to a sensitive field (credit_limit, tax_profile, status,
    loyalty adjustments, price rule changes, etc.) creates a log entry
    with before/after values, actor, source channel, and reason.

    This model is NEVER updated — corrections create superseding entries.
    """
    SOURCE_CHANNELS = (
        ('UI',     'User Interface'),
        ('API',    'API Call'),
        ('IMPORT', 'Bulk Import'),
        ('EVENT',  'System Event'),
        ('SYSTEM', 'Internal System'),
    )
    ACTIONS = (
        ('FIELD_CHANGE',     'Field Value Changed'),
        ('STATUS_CHANGE',    'Lifecycle Status Changed'),
        ('LOYALTY_ADJUST',   'Manual Loyalty Adjustment'),
        ('PRICE_RULE_CHANGE','Price Rule Modified'),
        ('GROUP_MEMBERSHIP', 'Price Group Membership Changed'),
        ('MERGE',            'Contact Merged'),
        ('BLOCK',            'Contact Blocked'),
        ('ARCHIVE',          'Contact Archived'),
        ('UNBLOCK',          'Contact Unblocked'),
        ('RESTORE',          'Contact Restored from Archive'),
    )

    contact = models.ForeignKey(
        Contact, on_delete=models.CASCADE,
        related_name='audit_log',
        help_text='The contact this audit entry belongs to'
    )
    action = models.CharField(max_length=30, choices=ACTIONS)
    field_name = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Name of the field that changed (for FIELD_CHANGE actions)'
    )
    old_value = models.TextField(null=True, blank=True, help_text='Previous value (JSON-safe string)')
    new_value = models.TextField(null=True, blank=True, help_text='New value (JSON-safe string)')
    reason = models.TextField(null=True, blank=True, help_text='Reason or comment for this change')
    source = models.CharField(max_length=10, choices=SOURCE_CHANNELS, default='UI')
    actor_user_id = models.IntegerField(null=True, blank=True, help_text='User who made the change')
    actor_name = models.CharField(max_length=255, null=True, blank=True, help_text='Display name of actor')
    correlation_id = models.CharField(
        max_length=100, null=True, blank=True,
        help_text='Request/event correlation ID for tracing'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'contact_audit_log'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['contact', '-created_at'], name='idx_audit_contact_time'),
            models.Index(fields=['tenant', 'action'], name='idx_audit_tenant_action'),
        ]

    def __str__(self):
        return f"[{self.action}] {self.contact.name}: {self.field_name or 'N/A'} @ {self.created_at}"

    @classmethod
    def log_change(cls, contact, action, field_name=None, old_value=None, new_value=None,
                   reason=None, source='UI', actor_user_id=None, actor_name=None, correlation_id=None):
        """Standardized change logging."""
        return cls.objects.create(
            tenant_id=contact.tenant_id,
            contact=contact,
            action=action,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            reason=reason,
            source=source,
            actor_user_id=actor_user_id,
            actor_name=actor_name,
            correlation_id=correlation_id,
        )

    def check_compliance(self, force_recompute=False):
        """
        11/10 Enterprise Compliance Check.
        Uses cached status by default for high performance.
        Returns: (is_compliant, missing_docs, expired_docs, error_message)
        """
        from ..services.compliance_service import ComplianceService
        from django.utils import timezone
        
        # If never checked or forced, recompute
        if force_recompute or not self.compliance_last_checked:
            ComplianceService.recompute_compliance(self)

        is_compliant = self.compliance_status == 'COMPLIANT' or self.compliance_status == 'EXPIRING_SOON'
        
        # If there's an active override, we consider them compliant for the block
        from .compliance_models import ComplianceOverride
        if not is_compliant:
            has_override = ComplianceOverride.objects.filter(
                contact=self, is_active=True, expiry_date__gt=timezone.now()
            ).exists()
            if has_override:
                is_compliant = True

        # For backward compatibility with simpler UI calls, we still return the structure
        # but the caller should ideally use the cached fields directly.
        missing = []
        expired = []
        if self.compliance_status == 'MISSING_DOC': missing = ['Required documents']
        if self.compliance_status == 'EXPIRED_DOC': expired = ['Some documents']
        
        msg = "" if is_compliant else f"Compliance Status: {self.get_compliance_status_display()}"
        
        return is_compliant, missing, expired, msg


class ContactTask(AuditLogMixin, TenantOwnedModel):
    """
    Automated or manual tasks linked to a contact.
    Used for tracking document renewals, follow-ups, etc.
    """
    TASK_TYPES = (
        ('COMPLIANCE_RENEWAL', 'Document Renewal Request'),
        ('FOLLOW_UP',          'Follow-up / Commercial'),
        ('KYC_UPDATE',         'KYC Update Needed'),
        ('OTHER',              'Other'),
    )
    PRIORITY_CHOICES = (
        ('LOW',    'Low'),
        ('NORMAL', 'Normal'),
        ('HIGH',   'High'),
        ('CRITICAL', 'Critical (Blocks Transactions)'),
    )
    STATUS_CHOICES = (
        ('OPEN',      'Open'),
        ('IN_PROGRESS', 'In Progress'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
    )

    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='tasks')
    type = models.CharField(max_length=50, choices=TASK_TYPES, default='FOLLOW_UP')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='NORMAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='OPEN')
    
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    assigned_to_user_id = models.IntegerField(null=True, blank=True)

    related_doc_id = models.IntegerField(null=True, blank=True, help_text='ID of ComplianceDocument if relevant')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contact_task'
        ordering = ['due_date', '-priority']

    def __str__(self):
        return f"{self.type}: {self.title} ({self.contact.name})"


class ContactComplianceDocument(AuditLogMixin, TenantOwnedModel):
    """
    Dynamic Compliance Document Tracking.
    Enables support for any country by adding specific document types.
    """
    DOCUMENT_TYPES = (
        ('NCC',               'Tax Register (NCC)'),
        ('RCCM',              'Commercial Register (RCCM)'),
        ('DFE',               'Electronic Invoicing (DFE)'),
        ('EXONERATION_TVA',   'VAT Exoneration Certificate'),
        ('EXONERATION_AIRSI', 'AIRSI Exoneration Certificate'),
        ('PASSPORT',          'Passport'),
        ('ID_CARD',           'Identity Card'),
        ('LICENSE',           'Operating License'),
        ('OTHER',             'Other Document'),
    )

    contact = models.ForeignKey(
        Contact, on_delete=models.CASCADE,
        related_name='compliance_documents'
    )
    type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    document_number = models.CharField(max_length=100)
    issue_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    reminder_days = models.IntegerField(default=30, help_text='Days before expiry to trigger alert')

    attachment = models.ForeignKey(
        'storage.StoredFile', on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='compliance_documents'
    )

    # ── Approval Layer (Missing Layer 7) ───────────────────────
    REVIEW_STATUSES = (
        ('UPLOADED',      'Uploaded (Pending Review)'),
        ('UNDER_REVIEW',  'Under Review'),
        ('APPROVED',      'Approved'),
        ('REJECTED',      'Rejected (Action Required)'),
        ('SUPERSEDED',    'Superseded by New Version'),
        ('REVOKED',       'Revoked / Invalidated'),
    )
    review_status = models.CharField(
        max_length=20, choices=REVIEW_STATUSES, default='UPLOADED'
    )
    
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.IntegerField(null=True, blank=True)

    notes = models.TextField(null=True, blank=True)
    
    # ── Versioning & Auditor Trail (Missing Layer 2) ───────────
    version = models.IntegerField(default=1)
    is_active = models.BooleanField(
        default=True, 
        help_text='Only the latest active version is used for compliance checks'
    )
    replaced_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='previous_versions'
    )
    # ── Security & Integrity (§Missing 17) ─────────────────────
    file_hash = models.CharField(max_length=64, null=True, blank=True, help_text='SHA-256 Checksum for legal non-repudiation')
    is_immutable = models.BooleanField(default=False, help_text='If True, document cannot be deleted or modified')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'contact_compliance_document'
        ordering = ['-expiry_date']

    def delete(self, *args, **kwargs):
        if self.is_immutable:
            raise ValidationError("Legal Lock: Immutable compliance documents cannot be deleted.")
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.type} - {self.document_number} ({self.contact.name})"

    @property
    def is_expired(self):
        from django.utils import timezone
        if not self.expiry_date:
            return False
        return self.expiry_date < timezone.now().date()

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        # If expiry date is coming up or changed, ensure a task exists
        if self.expiry_date:
            from datetime import timedelta
            from django.utils import timezone
            
            # Create a task 30 days before expiry if not exists
            reminder_date = self.expiry_date - timedelta(days=self.reminder_days)
            if timezone.now().date() >= reminder_date:
                ContactTask.objects.get_or_create(
                    tenant_id=self.tenant_id,
                    contact=self.contact,
                    type='COMPLIANCE_RENEWAL',
                    related_doc_id=self.id,
                    status='OPEN',
                    defaults={
                        'title': f"Renew {self.get_type_display()} - {self.document_number}",
                        'description': f"Document {self.type} is expiring on {self.expiry_date}.",
                        'due_date': self.expiry_date,
                        'priority': 'HIGH'
                    }
                )
