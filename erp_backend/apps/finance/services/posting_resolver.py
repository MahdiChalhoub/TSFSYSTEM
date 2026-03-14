"""
PostingResolver
===============
Single source of truth for resolving GL accounts from posting rules.

Resolution hierarchy:
  1. ContextualPostingRule (if context dict provided)
  2. OrgTaxPolicy (for tax-related events)
  3. PostingRule model (with legacy code mapping)
  4. JSON blob fallback
  5. ValidationError (if required=True)

Usage:
    from apps.finance.services.posting_resolver import PostingResolver, PostingEvents

    # Single account
    vat_acc = PostingResolver.resolve(org, PostingEvents.SALES_VAT_COLLECTED)

    # Multiple accounts
    accs = PostingResolver.resolve_many(org, [
        PostingEvents.SALES_RECEIVABLE,
        PostingEvents.SALES_REVENUE,
        PostingEvents.SALES_VAT_COLLECTED,
    ])

    # Snapshot capture (for JournalEntry audit trail)
    snapshot = PostingResolver.capture_snapshot(org, [...event_codes...])

GOVERNANCE RULE:
    New code must NOT call ConfigurationService.get_posting_rules() directly
    for posting resolution. All posting resolution must go through PostingResolver.
"""
import logging
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════
# Event Code Registry — authoritative catalog of all posting event codes
# ═══════════════════════════════════════════════════════════════════════

class PostingEvents:
    """
    Canonical event codes for posting rule resolution.
    Always use these constants instead of raw strings to prevent typos and drift.

    Phase A: includes both legacy flat codes (backward compat) and new 3-level taxonomy.
    """
    # ── Sales ── (legacy flat codes still used in existing services)
    SALES_RECEIVABLE       = 'sales.receivable'
    SALES_REVENUE          = 'sales.revenue'
    SALES_COGS             = 'sales.cogs'
    SALES_INVENTORY        = 'sales.inventory'
    SALES_ROUND_OFF        = 'sales.round_off'
    SALES_DISCOUNT         = 'sales.discount'
    SALES_VAT_COLLECTED    = 'sales.vat_collected'

    # ── Purchases ──
    PURCHASES_PAYABLE          = 'purchases.payable'
    PURCHASES_INVENTORY        = 'purchases.inventory'
    PURCHASES_EXPENSE          = 'purchases.expense'
    PURCHASES_VAT_RECOVERABLE  = 'purchases.vat_recoverable'
    PURCHASES_VAT_SUSPENSE     = 'purchases.vat_suspense'
    PURCHASES_AIRSI_PAYABLE    = 'purchases.airsi_payable'
    PURCHASES_AIRSI            = 'purchases.airsi'
    PURCHASES_REVERSE_CHARGE   = 'purchases.reverse_charge_vat'
    PURCHASES_DISCOUNT_EARNED  = 'purchases.discount_earned'
    PURCHASES_DELIVERY_FEES    = 'purchases.delivery_fees'

    # ── Inventory ──
    INVENTORY_ADJUSTMENT   = 'inventory.adjustment'
    INVENTORY_TRANSFER     = 'inventory.transfer'

    # ── Tax Control ──
    TAX_VAT_PAYABLE            = 'tax.vat_payable'
    TAX_VAT_REFUND_RECEIVABLE  = 'tax.vat_refund_receivable'

    # ── Automation ──
    AUTOMATION_CUSTOMER_ROOT   = 'automation.customerRoot'
    AUTOMATION_SUPPLIER_ROOT   = 'automation.supplierRoot'
    AUTOMATION_PAYROLL_ROOT    = 'automation.payrollRoot'

    # ── Fixed Assets ──
    FIXED_ASSETS_DEPRECIATION      = 'fixedAssets.depreciationExpense'
    FIXED_ASSETS_ACCUMULATED_DEPR  = 'fixedAssets.accumulatedDepreciation'

    # ── Suspense ──
    SUSPENSE_RECEPTION     = 'suspense.reception'

    # ── Partners ──
    PARTNERS_CAPITAL       = 'partners.capital'
    PARTNERS_LOAN          = 'partners.loan'
    PARTNERS_WITHDRAWAL    = 'partners.withdrawal'

    # ── Equity ──
    EQUITY_CAPITAL         = 'equity.capital'
    EQUITY_DRAWS           = 'equity.draws'


class PostingResolver:
    """
    Centralized GL account resolution engine.

    Eliminates scattered `rules.get('section', {}).get('key')` + OrgTaxPolicy
    boilerplate across all services. All GL account lookups go through here.
    """

    # ── Tax-related event codes → OrgTaxPolicy field mapping ──────────
    TAX_POLICY_MAP = {
        PostingEvents.SALES_VAT_COLLECTED:        'vat_collected_account_id',
        PostingEvents.PURCHASES_VAT_RECOVERABLE:  'vat_recoverable_account_id',
        PostingEvents.PURCHASES_VAT_SUSPENSE:     'vat_suspense_account_id',
        PostingEvents.PURCHASES_AIRSI_PAYABLE:    'airsi_account_id',
        PostingEvents.PURCHASES_AIRSI:            'airsi_account_id',
        PostingEvents.PURCHASES_REVERSE_CHARGE:   'reverse_charge_account_id',
        PostingEvents.TAX_VAT_PAYABLE:            'vat_payable_account_id',
        PostingEvents.TAX_VAT_REFUND_RECEIVABLE:  'vat_refund_receivable_account_id',
        # New 3-level codes → same Tax Engine fields
        'sales.invoice.vat_output':               'vat_collected_account_id',
        'purchases.invoice.vat_input':            'vat_recoverable_account_id',
        'tax.vat.output':                         'vat_collected_account_id',
        'tax.vat.input':                          'vat_recoverable_account_id',
        'tax.vat.payable':                        'vat_payable_account_id',
        'tax.vat.recoverable':                    'vat_refund_receivable_account_id',
        'tax.vat.suspense':                       'vat_suspense_account_id',
        'tax.airsi.payable':                      'airsi_account_id',
        'tax.airsi.purchases':                    'airsi_account_id',
        'tax.settlement.reverse_charge':          'reverse_charge_account_id',
    }

    # ── Per-request cache ─────────────────────────────────────────────
    _policy_cache = {}      # keyed by org.id
    _rules_cache = {}       # keyed by org.id
    _ctx_cache = {}         # keyed by org.id

    @classmethod
    def resolve(cls, organization, event_code, required=True, context=None):
        """
        Resolve a GL account ID for a given event_code.

        Supports:
        - Context-aware overrides (warehouse, branch, category, etc.)
        - Both legacy flat codes (sales.receivable) and new 3-level codes
        - Tax policy priority for tax-related events

        Args:
            organization: Organization instance
            event_code:   dotted key, e.g. PostingEvents.SALES_RECEIVABLE
            required:     if True, raises ValidationError when no account found
            context:      Optional dict for contextual resolution, e.g.
                          {'WAREHOUSE': 'WH-EXPORT'} or {'BRANCH': '2'}

        Returns:
            int (account ID) or None
        """
        account_id = None

        # 0. Check contextual overrides first (most specific wins)
        if context:
            account_id = cls._resolve_contextual(organization, event_code, context)

        # 1. Check OrgTaxPolicy for tax-related events
        if event_code in cls.TAX_POLICY_MAP:
            account_id = cls._resolve_from_tax_policy(
                organization, cls.TAX_POLICY_MAP[event_code]
            )

        # 2. Fallback to posting rules (model + JSON merged)
        if not account_id:
            account_id = cls._resolve_from_rules(organization, event_code)

        # 2b. Try legacy mapping if not found with new code
        if not account_id:
            from apps.finance.services.posting_event_catalog import LEGACY_EVENT_MAP
            # Try both directions: legacy→new and new→legacy
            mapped_code = LEGACY_EVENT_MAP.get(event_code)
            if mapped_code:
                account_id = cls._resolve_from_rules(organization, mapped_code)
            else:
                # Reverse lookup: maybe we got a new code, find old one
                reverse_map = {v: k for k, v in LEGACY_EVENT_MAP.items()}
                old_code = reverse_map.get(event_code)
                if old_code:
                    account_id = cls._resolve_from_rules(organization, old_code)

        # 3. Error if required and not found
        if required and not account_id:
            human_label = event_code.replace('.', ' → ').replace('_', ' ').title()
            raise ValidationError(
                f"Posting account not configured: '{event_code}' ({human_label}). "
                f"Configure in Finance → Posting Rules."
            )

        return account_id

    @classmethod
    def resolve_many(cls, organization, event_codes):
        """
        Resolve multiple event codes in one call.
        Optimized: loads Tax Policy and Posting Rules once, resolves in memory.

        Returns:
            dict { event_code: account_id | None }
        """
        results = {}
        for code in event_codes:
            results[code] = cls.resolve(organization, code, required=False)
        return results

    @classmethod
    def resolve_required(cls, organization, event_codes):
        """
        Resolve multiple event codes, ALL required.
        Raises a single ValidationError listing all missing accounts.
        """
        results = cls.resolve_many(organization, event_codes)
        missing = [code for code, acc in results.items() if acc is None]

        if missing:
            labels = ', '.join(f"'{c}'" for c in missing)
            raise ValidationError(
                f"Posting accounts not configured: {labels}. "
                f"Configure in Finance → Posting Rules."
            )
        return results

    @classmethod
    def capture_snapshot(cls, organization, event_codes):
        """
        Capture a posting snapshot for audit trail.
        Returns a list of resolved rule details to store on JournalEntry.posting_snapshot.

        Usage:
            snapshot = PostingResolver.capture_snapshot(org, [
                'sales.invoice.receivable',
                'sales.invoice.revenue',
                'sales.invoice.vat_output',
            ])
            journal_entry.posting_snapshot = snapshot
            journal_entry.save()
        """
        snapshot = []
        for code in event_codes:
            acc_id = cls.resolve(organization, code, required=False)
            entry = {
                'event_code': code,
                'account_id': acc_id,
                'account_code': None,
                'account_name': None,
                'rule_source': 'NONE',
            }

            if acc_id:
                try:
                    from apps.finance.models import ChartOfAccount
                    account = ChartOfAccount.objects.filter(id=acc_id).values('code', 'name').first()
                    if account:
                        entry['account_code'] = account['code']
                        entry['account_name'] = account['name']
                except Exception:
                    pass

                # Determine source
                if code in cls.TAX_POLICY_MAP:
                    policy = cls._get_policy(organization)
                    if policy and getattr(policy, cls.TAX_POLICY_MAP[code], None) == acc_id:
                        entry['rule_source'] = 'TAX_POLICY'
                    else:
                        entry['rule_source'] = 'POSTING_RULE'
                else:
                    entry['rule_source'] = 'POSTING_RULE'

            snapshot.append(entry)
        return snapshot

    # ── Internal Resolution Methods ───────────────────────────────────

    # ── Event code → TaxAccountMapping.tax_type ──────────────────────
    TAX_TYPE_MAP = {
        'sales.invoice.vat_output':           'VAT_OUTPUT',
        'sales.vat_collected':                'VAT_OUTPUT',
        'purchases.invoice.vat_input':        'VAT_INPUT',
        'purchases.vat_recoverable':          'VAT_INPUT',
        'tax.vat.output':                     'VAT_OUTPUT',
        'tax.vat.input':                      'VAT_INPUT',
        'tax.vat.payable':                    'VAT_PAYABLE',
        'tax.vat.recoverable':                'VAT_REFUND',
        'tax.vat.suspense':                   'VAT_SUSPENSE',
        'tax.airsi.payable':                  'AIRSI',
        'tax.airsi.purchases':                'AIRSI',
        'tax.settlement.reverse_charge':      'REVERSE_CHARGE',
        'tax.withholding.sales':              'WHT_SALES',
        'tax.withholding.purchases':          'WHT_PURCHASES',
        'tax.withholding.payable':            'WHT_PAYABLE',
        'tax.settlement.vat_payable':         'VAT_PAYABLE',
        'tax.settlement.vat_recoverable':     'VAT_REFUND',
    }

    # Per-request cache for TaxAccountMapping
    _tax_mapping_cache = {}  # keyed by org.id → {tax_type: account_id}

    @classmethod
    def _resolve_from_tax_policy(cls, organization, field_name):
        """
        Resolve from tax accounts. Dual-read:
          1. TaxAccountMapping rows (new, normalized)
          2. OrgTaxPolicy FK column (legacy fallback)
        """
        # 1. Try TaxAccountMapping first
        # Reverse-lookup: field_name → tax_type
        FK_TO_TYPE = {
            'vat_collected_account_id':        'VAT_OUTPUT',
            'vat_recoverable_account_id':      'VAT_INPUT',
            'vat_payable_account_id':          'VAT_PAYABLE',
            'vat_refund_receivable_account_id': 'VAT_REFUND',
            'vat_suspense_account_id':         'VAT_SUSPENSE',
            'airsi_account_id':                'AIRSI',
            'reverse_charge_account_id':       'REVERSE_CHARGE',
        }
        tax_type = FK_TO_TYPE.get(field_name)
        if tax_type:
            account_id = cls._resolve_from_tax_mapping(organization, tax_type)
            if account_id:
                return account_id

        # 2. Fallback to OrgTaxPolicy FK columns (legacy)
        try:
            policy = cls._get_policy(organization)
            return getattr(policy, field_name, None) if policy else None
        except ImportError:
            logger.warning("Finance module not installed — Tax Engine resolution unavailable")
            return None
        except Exception as exc:
            logger.exception(
                "Tax policy resolution failed for %s.%s",
                organization, field_name,
                extra={'organization_id': getattr(organization, 'id', None)}
            )
            return None

    @classmethod
    def _resolve_from_tax_mapping(cls, organization, tax_type):
        """Resolve from TaxAccountMapping rows (cached per-request)."""
        org_id = organization.id

        if org_id not in cls._tax_mapping_cache:
            try:
                from apps.finance.models import TaxAccountMapping
                policy = cls._get_policy(organization)
                if not policy:
                    cls._tax_mapping_cache[org_id] = {}
                    return None

                mappings = dict(
                    TaxAccountMapping.objects.filter(
                        policy=policy, account__isnull=False
                    ).values_list('tax_type', 'account_id')
                )
                cls._tax_mapping_cache[org_id] = mappings
            except Exception as exc:
                logger.warning("Could not load TaxAccountMapping: %s", exc)
                cls._tax_mapping_cache[org_id] = {}

        return cls._tax_mapping_cache.get(org_id, {}).get(tax_type)

    @classmethod
    def _get_policy(cls, organization):
        """Get the default OrgTaxPolicy, with per-request caching."""
        org_id = organization.id
        if org_id in cls._policy_cache:
            return cls._policy_cache[org_id]

        try:
            from apps.finance.models import OrgTaxPolicy
            policy = OrgTaxPolicy.objects.filter(
                organization=organization, is_default=True
            ).first() or OrgTaxPolicy.objects.filter(
                organization=organization
            ).first()
        except ImportError:
            policy = None
        except Exception as exc:
            logger.exception(
                "Failed to load OrgTaxPolicy for org %s", organization.id
            )
            policy = None

        cls._policy_cache[org_id] = policy
        return policy

    @classmethod
    def _get_rules(cls, organization):
        """Get posting rules dict, with per-request caching.
        Phase 2: loads from PostingRule model first, falls back to JSON.
        """
        org_id = organization.id
        if org_id in cls._rules_cache:
            return cls._rules_cache[org_id]

        # Phase 2: Try model-based rules first
        model_rules = cls._load_model_rules(organization)

        # Fallback: merge with JSON blob (JSON fills gaps only)
        from erp.services import ConfigurationService
        json_rules = ConfigurationService.get_posting_rules(organization)

        # Build a flat dict from JSON for comparison
        json_flat = {}
        for section, mappings in json_rules.items():
            if isinstance(mappings, dict):
                for key, val in mappings.items():
                    if val:
                        json_flat[f"{section}.{key}"] = val

        # Model rules override JSON rules
        merged = {**json_flat, **model_rules}
        cls._rules_cache[org_id] = merged
        return merged

    @classmethod
    def _load_model_rules(cls, organization):
        """Load active PostingRules from the database as flat dict."""
        try:
            from apps.finance.models import PostingRule
            return dict(
                PostingRule.objects.filter(
                    organization=organization, is_active=True
                ).values_list('event_code', 'account_id')
            )
        except Exception as exc:
            logger.warning("Could not load PostingRule model: %s", exc)
            return {}

    @classmethod
    def _resolve_from_rules(cls, organization, event_code):
        """Resolve from merged rules (model + JSON fallback)."""
        rules = cls._get_rules(organization)
        return rules.get(event_code)

    @classmethod
    def clear_cache(cls, organization_id=None):
        """Clear per-request caches. Call from middleware or tests."""
        if organization_id:
            cls._policy_cache.pop(organization_id, None)
            cls._rules_cache.pop(organization_id, None)
            cls._ctx_cache.pop(organization_id, None)
            cls._tax_mapping_cache.pop(organization_id, None)
        else:
            cls._policy_cache.clear()
            cls._rules_cache.clear()
            cls._ctx_cache.clear()
            cls._tax_mapping_cache.clear()

    @classmethod
    def _resolve_contextual(cls, organization, event_code, context):
        """Resolve from ContextualPostingRule based on context dict."""
        org_id = organization.id

        # Load contextual rules for this org (cached)
        if org_id not in cls._ctx_cache:
            try:
                from apps.finance.models import ContextualPostingRule
                rules = list(
                    ContextualPostingRule.objects.filter(
                        organization=organization, is_active=True
                    ).values('event_code', 'context_type', 'context_value', 'account_id', 'priority')
                    .order_by('-priority')
                )
                cls._ctx_cache[org_id] = rules
            except Exception as exc:
                logger.warning("Could not load contextual rules: %s", exc)
                cls._ctx_cache[org_id] = []

        # Find best match: highest priority rule where context matches
        for rule in cls._ctx_cache[org_id]:
            if rule['event_code'] != event_code:
                continue
            ctx_type = rule['context_type']
            ctx_value = rule['context_value']
            if ctx_type in context and str(context[ctx_type]) == str(ctx_value):
                return rule['account_id']

        return None
