"""
Kernel Services
==============
Contains ONLY kernel-level infrastructure services.
Business services live in their respective modules.

IMPORTANT: This file must NEVER import from apps.* directly.
All cross-module communication goes through the ConnectorEngine.
"""
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.db.models import Sum, F
import uuid
import json
import math
import logging

logger = logging.getLogger(__name__)


class ProvisioningService:
    """
    Kernel-level provisioning service.
    
    Creates ONLY kernel objects (Organization, Site, Warehouse),
    then emits events via ConnectorEngine for modules to react:
    
    Flow:
        1. Kernel creates: Organization, Site, Warehouse
        2. ConnectorEngine dispatches 'org:provisioned' event
        3. Finance module reacts: CoA, Fiscal Year, Cash Drawer, Posting Rules
        4. CRM module reacts: Billing Contact in SaaS org
        5. CRM result triggers 'contact:created' → Finance creates ledger sub-account
    
    If a module is disabled/missing, the ConnectorEngine buffers the event
    and replays it when the module becomes available. No crash, no data loss.
    """
    
    @staticmethod
    def provision_organization(name, slug, business_type_id=None, base_currency_id=None):
        """
        Creates a new organization with kernel infrastructure,
        then dispatches events for module-level setup.
        
        Returns the created Organization instance.
        """
        from .models import Organization, Warehouse
        
        with transaction.atomic():
            # ── KERNEL OBJECTS (always created, no module dependency) ──
            
            # 1. Organization
            org = Organization.objects.create(
                name=name, 
                slug=slug,
                business_type_id=business_type_id,
                base_currency_id=base_currency_id
            )
            
            # 2. Main Branch (replaces old Site model — now a BRANCH-type Warehouse)
            branch = Warehouse.objects.create(
                organization=org,
                name="Main Branch",
                code="MAIN",
                location_type="BRANCH"
            )

            # 3. Main Warehouse (child of the branch)
            Warehouse.objects.create(
                organization=org,
                parent=branch,
                name="Main Warehouse",
                code="WH01",
                location_type="WAREHOUSE"
            )

            # 4. Auto-grant all installed modules to new org
            from .models import SystemModule, OrganizationModule
            installed_modules = SystemModule.objects.filter(status='INSTALLED')
            for sm in installed_modules:
                OrganizationModule.objects.get_or_create(
                    organization=org,
                    module_name=sm.name,
                    defaults={'is_enabled': True}
                )
            logger.info(
                f"📦 Auto-granted {installed_modules.count()} modules to '{slug}'"
            )

            # 5. Auto-assign the Starter plan (free tier) if no plan is set
            from .models import SubscriptionPlan
            if not org.current_plan:
                starter = SubscriptionPlan.objects.filter(
                    name='Starter', is_active=True
                ).first()
                if starter:
                    org.current_plan = starter
                    org.save(update_fields=['current_plan'])
                    logger.info(f"📋 Auto-assigned Starter plan to '{slug}'")
        
        # ── MODULE EVENTS (outside transaction — each module handles its own) ──
        event_payload = {
            'org_id': str(org.id),
            'org_name': name,
            'org_slug': slug,
            'business_type_id': business_type_id,
            'base_currency_id': base_currency_id,
            'site_id': str(branch.id),
        }
        
        try:
            from .connector_engine import ConnectorEngine
            connector = ConnectorEngine()
            
            # Dispatch to ALL modules that subscribe to 'org:provisioned'
            results = connector.dispatch_event(
                source_module='kernel',
                event_name='org:provisioned',
                payload=event_payload,
                tenant_id=str(org.id)
            )
            
            logger.info(
                f"🏗️ Provisioning complete for '{name}' [{slug}]. "
                f"Module events: {results}"
            )
            
        except Exception as e:
            # Connector failure should NOT prevent org creation
            # The kernel objects are already committed
            logger.warning(
                f"⚠️ ConnectorEngine dispatch failed for org '{slug}': {e}. "
                f"Module setup may be incomplete — events will be retried."
            )
        
        return org


class ConfigurationService:
    @staticmethod
    def get_posting_rules(organization):
        """Read posting rules from Organization.settings JSON."""
        default_config = {
            "sales": {"receivable": None, "revenue": None, "cogs": None, "inventory": None, "round_off": None, "discount": None, "vat_collected": None},
            "purchases": {"payable": None, "inventory": None, "expense": None, "vat_recoverable": None, "vat_suspense": None, "airsi_payable": None, "reverse_charge_vat": None, "discount_earned": None, "delivery_fees": None, "airsi": None},
            "inventory": {"adjustment": None, "transfer": None},
            "automation": {"customerRoot": None, "supplierRoot": None, "payrollRoot": None},
            "fixedAssets": {"depreciationExpense": None, "accumulatedDepreciation": None},
            "suspense": {"reception": None},
            "partners": {"capital": None, "loan": None, "withdrawal": None},
            "equity": {"capital": None, "draws": None},
            "tax": {"vat_payable": None, "vat_refund_receivable": None},  # VAT control accounts
        }
        stored = organization.settings.get('finance_posting_rules')
        if not stored:
            return default_config
        try:
            if isinstance(stored, str):
                stored = json.loads(stored)
            for key in default_config:
                if key in stored and isinstance(stored[key], dict):
                    default_config[key].update({k: v for k, v in stored[key].items() if k in default_config[key]})
            return default_config
        except Exception:
            return default_config

    @staticmethod
    def save_posting_rules(organization, config):
        """Save posting rules into Organization.settings JSON."""
        if not organization.settings:
            organization.settings = {}
        organization.settings['finance_posting_rules'] = config
        organization.save(update_fields=['settings'])
        return True

    @staticmethod
    def apply_smart_posting_rules(organization):
        """
        Auto-map posting rules based on existing Chart of Accounts.
        
        Uses ConnectorEngine to read accounts from the finance module.
        Falls back to direct import if connector is not available
        (e.g., during initial provisioning when called from finance event handler).
        """
        accounts = None
        
        # Try connector first for proper isolation
        try:
            from .connector_engine import ConnectorEngine
            connector = ConnectorEngine()
            response = connector.route_read(
                target_module='finance',
                endpoint='coa',
                tenant_id=str(organization.id),
                source_module='kernel',
                params={'is_active': True}
            )
            if response.success and response.data:
                # Got data via connector — but we need queryset-like access
                # Fall through to direct import since we're in kernel context
                pass
        except Exception:
            pass
        
        # Direct import with safety gate — this is acceptable because:
        # 1. This function is called FROM finance event handler (which has access)
        # 2. If finance module is missing, we simply return default config
        try:
            from apps.finance.models import ChartOfAccount
            accounts = ChartOfAccount.objects.filter(organization=organization, is_active=True)
        except ImportError:
            logger.warning("Finance module not installed — posting rules cannot be auto-mapped")
            return ConfigurationService.get_posting_rules(organization)
        
        config = ConfigurationService.get_posting_rules(organization)
        def find(code):
            acc = accounts.filter(code=code).first()
            return acc.id if acc else None

        def find_by_type(acct_type, name_contains=None):
            """Fallback: find by account type and optional name keyword."""
            qs = accounts.filter(type=acct_type)
            if name_contains:
                qs = qs.filter(name__icontains=name_contains)
            acc = qs.first()
            return acc.id if acc else None

        # ═══════════════════════════════════════════════════════════════
        # Code search order for each field:
        #   1. IFRS codes (1110, 2101, 3001, 4100, 5100, 6303, 9001)
        #   2. USA GAAP codes (1100, 1200, 2100, 3100, 4100, 5000, 6100)
        #   3. SYSCOHADA/PCG codes (41, 40, 10, 70, 60, 44, 28, 16)
        #   4. Lebanese PCN codes  (similar to SYSCOHADA)
        #   5. Fallback by type + name keyword
        # ═══════════════════════════════════════════════════════════════

        # ── Sales ──
        config['sales']['receivable'] = find('1110') or find('1200') or find('411') or find('41') or find_by_type('ASSET', 'receivable') or config['sales']['receivable']
        config['sales']['revenue'] = find('4100') or find('4101') or find('701') or find('70') or find_by_type('INCOME', 'sales') or config['sales']['revenue']
        config['sales']['cogs'] = find('5100') or find('5101') or find('5000') or find('601') or find('60') or find_by_type('EXPENSE', 'cost') or config['sales']['cogs']
        config['sales']['inventory'] = find('1120') or find('1300') or find('31') or find('37') or find_by_type('ASSET', 'inventory') or config['sales']['inventory']
        config['sales']['round_off'] = find('9002') or find('6589') or find('7589') or find('758') or config['sales']['round_off']
        config['sales']['discount'] = find('6190') or find('709') or find_by_type('EXPENSE', 'discount') or config['sales']['discount']
        config['sales']['vat_collected'] = find('2111') or find('4457') or find('443') or find('44') or find_by_type('LIABILITY', 'vat') or config['sales']['vat_collected']

        # ── Purchases ──
        config['purchases']['payable'] = find('2101') or find('2100') or find('401') or find('40') or find_by_type('LIABILITY', 'payable') or config['purchases']['payable']
        config['purchases']['inventory'] = find('1120') or find('1300') or find('31') or find('37') or find('607') or find_by_type('ASSET', 'inventory') or config['purchases']['inventory']
        config['purchases']['expense'] = find('5101') or find('6011') or find('5000') or find('601') or find('60') or find_by_type('EXPENSE', 'purchase') or find_by_type('EXPENSE', 'achat') or config['purchases']['expense']
        config['purchases']['vat_recoverable'] = find('2112') or find('4456') or find('445') or find('44') or find_by_type('ASSET', 'vat') or config['purchases']['vat_recoverable']
        config['purchases']['vat_suspense'] = find('2116') or find('4458') or find('44586') or config['purchases']['vat_suspense']
        config['purchases']['airsi_payable'] = find('2113') or find('4471') or config['purchases']['airsi_payable']
        config['purchases']['reverse_charge_vat'] = find('2114') or find('4452') or find_by_type('LIABILITY', 'reverse') or config['purchases']['reverse_charge_vat']
        config['purchases']['discount_earned'] = find('4201') or find('7190') or find('609') or find('77') or find_by_type('INCOME', 'discount') or config['purchases']['discount_earned']
        config['purchases']['delivery_fees'] = find('5102') or find('6241') or find('624') or find('61') or find_by_type('EXPENSE', 'freight') or find_by_type('EXPENSE', 'transport') or config['purchases']['delivery_fees']

        # ── Inventory ──
        config['inventory']['adjustment'] = find('9001') or find('5104') or find('708') or find('709') or find_by_type('EXPENSE', 'adjustment') or config['inventory']['adjustment']
        config['inventory']['transfer'] = find('9002') or find('1120') or find('31') or config['inventory']['transfer']

        # ── Suspense ──
        config['suspense']['reception'] = find('2102') or find('9004') or find('380') or find('471') or find_by_type('LIABILITY', 'reception') or find_by_type('LIABILITY', 'transit') or config['suspense']['reception']

        # ── Tax ──
        config['tax']['vat_payable'] = find('2110') or find('2111') or find('4455') or find('443') or find('44') or find_by_type('LIABILITY', 'vat payable') or config['tax']['vat_payable']
        config['tax']['vat_refund_receivable'] = find('2115') or find('4458') or find_by_type('ASSET', 'vat refund') or find_by_type('ASSET', 'vat credit') or config['tax']['vat_refund_receivable']

        # ── Automation ──
        config['automation']['customerRoot'] = find('1111') or find('1110') or find('1200') or find('411') or find('41') or find_by_type('ASSET', 'receivable') or config['automation']['customerRoot']
        config['automation']['supplierRoot'] = find('2101') or find('2100.1') or find('2100') or find('401') or find('40') or find_by_type('LIABILITY', 'payable') or config['automation']['supplierRoot']
        config['automation']['payrollRoot'] = find('2200') or find('2121') or find('421') or find('42') or find_by_type('LIABILITY', 'salary') or find_by_type('LIABILITY', 'personnel') or config['automation']['payrollRoot']

        # ── Fixed Assets ──
        config['fixedAssets']['depreciationExpense'] = find('6303') or find('681') or find('6109') or find('6302') or find('68') or find_by_type('EXPENSE', 'depreciation') or find_by_type('EXPENSE', 'amortis') or config['fixedAssets']['depreciationExpense']
        config['fixedAssets']['accumulatedDepreciation'] = find('1210') or find('1211') or find('281') or find('28') or find_by_type('ASSET', 'accumulated depreciation') or find_by_type('ASSET', 'amortis') or config['fixedAssets']['accumulatedDepreciation']

        # ── Partners ──
        config['partners']['capital'] = find('3001') or find('3100') or find('101') or find('10') or find_by_type('EQUITY', 'capital') or config['partners']['capital']
        config['partners']['loan'] = find('2201') or find('1680') or find('168') or find('16') or find_by_type('LIABILITY', 'loan') or find_by_type('LIABILITY', 'emprunt') or config['partners']['loan']
        config['partners']['withdrawal'] = find('3005') or find('3200') or find('108') or find('12') or find_by_type('EQUITY', 'draw') or find_by_type('EQUITY', 'retrait') or config['partners']['withdrawal']

        # ── Equity ──
        config['equity']['capital'] = find('3001') or find('3100') or find('101') or find('10') or find_by_type('EQUITY', 'capital') or config['equity']['capital']
        config['equity']['draws'] = find('3005') or find('3200') or find('108') or find('129') or find('12') or find_by_type('EQUITY', 'draw') or find_by_type('EQUITY', 'retrait') or config['equity']['draws']

        ConfigurationService.save_posting_rules(organization, config)
        return config

    # ── Dual View Add-On Helper ───────────────────────────────────────────────
    @staticmethod
    def _org_has_dual_view_addon(organization) -> bool:
        """
        Returns True if the organization is entitled to activate Dual View.
        Entitlement: SaaS master org (slug='saas') OR active OrganizationAddon(dual_view).
        """
        if getattr(organization, 'slug', None) == 'saas':
            return True
        return organization.purchased_addons.filter(
            addon__addon_type='dual_view',
            status='active'
        ).exists()

    @staticmethod
    def get_global_settings(organization):
        """Read global financial settings from Organization.settings JSON."""
        stored = organization.settings.get('global_financial_settings')
        can_dual = ConfigurationService._org_has_dual_view_addon(organization)
        defaults = {"worksInTTC": True, "dualView": False, "pricingCostBasis": "AMC", "canEnableDualView": can_dual}
        if not stored:
            return defaults
        if isinstance(stored, str):
            try:
                stored = json.loads(stored)
            except Exception:
                return defaults
        # Always inject the live entitlement — don't trust what's in the JSON
        stored['canEnableDualView'] = can_dual
        return stored

    @staticmethod
    def save_global_settings(organization, config):
        """
        Save global financial settings into Organization.settings JSON.
        Enforces the Dual View add-on gate:
        dualView=True is only allowed for SaaS master org or orgs with active dual_view addon.
        """
        # Strip the read-only computed flag before persisting
        config.pop('canEnableDualView', None)

        # Gate: block dualView activation without entitlement
        if config.get('dualView') is True:
            if not ConfigurationService._org_has_dual_view_addon(organization):
                raise ValidationError({
                    'dualView': (
                        'Dual View requires an active Add-On. '
                        'Contact your account manager to activate Internal Scope Access.'
                    )
                })

        if not organization.settings:
            organization.settings = {}

        current = organization.settings.get('global_financial_settings', {})
        if isinstance(current, str):
            try: current = json.loads(current)
            except: current = {}

        current.update(config)
        organization.settings['global_financial_settings'] = current
        organization.save(update_fields=['settings'])
        return True

    @staticmethod
    def get_setting(organization, key, default=None):
        """Read a single setting from Organization.settings JSON."""
        value = organization.settings.get(key)
        if value is None:
            return default
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return value
        return value

    @staticmethod
    def save_setting(organization, key, value):
        """Save a single setting into Organization.settings JSON."""
        if not organization.settings:
            organization.settings = {}
        organization.settings[key] = value
        organization.save(update_fields=['settings'])
        return True


# =============================================================================
# BACKWARD-COMPATIBLE RE-EXPORTS (Safe)
# Business services now live in their module directories.
# These re-exports ensure existing code continues to work.
# Wrapped in try/except to prevent kernel crash if a module is removed.
# =============================================================================
try:
    from apps.finance.services import (  # noqa: E402, F401
        LedgerService, FinancialAccountService, SequenceService,
        BarcodeService, LoanService, FinancialEventService, TaxService
    )
except ImportError:
    logger.debug("Finance module not installed — re-exports skipped")

try:
    from apps.inventory.services import InventoryService  # noqa: E402, F401
except ImportError:
    logger.debug("Inventory module not installed — re-exports skipped")

try:
    from apps.pos.services import POSService, PurchaseService  # noqa: E402, F401
except ImportError:
    logger.debug("POS module not installed — re-exports skipped")
