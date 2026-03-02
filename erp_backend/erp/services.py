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
                organization_id=str(org.id)
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
            "sales": {"receivable": None, "revenue": None, "cogs": None, "inventory": None, "round_off": None, "discount": None, "tax": None},
            "purchases": {"payable": None, "inventory": None, "tax": None, "airsi_payable": None},
            "inventory": {"adjustment": None, "transfer": None},
            "automation": {"customerRoot": None, "supplierRoot": None, "payrollRoot": None},
            "fixedAssets": {"depreciationExpense": None, "accumulatedDepreciation": None},
            "suspense": {"reception": None},
            "partners": {"capital": None, "loan": None, "withdrawal": None},
            "equity": {"capital": None, "draws": None}
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
                organization_id=str(organization.id),
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
        config['sales']['receivable'] = find('1110') or find('1300') or find('411') or find('41') or config['sales']['receivable']
        config['sales']['revenue'] = find('4100') or find('701') or find('70') or config['sales']['revenue']
        config['sales']['cogs'] = find('5100') or find('601') or find('60') or config['sales']['cogs']
        config['sales']['inventory'] = find('1120') or find('31') or find('37') or config['sales']['inventory']
        config['purchases']['payable'] = find('2101') or find('401') or find('40') or config['purchases']['payable']
        config['purchases']['inventory'] = find('1120') or find('31') or find('37') or find('607') or config['purchases']['inventory']
        config['purchases']['tax'] = find('2111') or find('4456') or find('445') or config['purchases']['tax']
        config['inventory']['adjustment'] = find('5104') or find('708') or find('709') or config['inventory']['adjustment']
        config['inventory']['transfer'] = find('1120') or find('31') or config['inventory']['transfer']
        config['suspense']['reception'] = find('2102') or find('9004') or config['suspense']['reception']
        
        config['automation']['customerRoot'] = find('1111') or find('1110') or find('1200') or find('411') or find('41') or config['automation']['customerRoot']
        config['automation']['supplierRoot'] = find('2101') or find('2100.1') or find('2100') or find('401') or find('40') or config['automation']['supplierRoot']
        config['automation']['payrollRoot'] = find('2200') or find('421') or find('42') or config['automation']['payrollRoot']
        
        ConfigurationService.save_posting_rules(organization, config)
        return config

    @staticmethod
    def get_global_settings(organization):
        """Read global financial settings from Organization.settings JSON."""
        stored = organization.settings.get('global_financial_settings')
        if not stored:
            return {"worksInTTC": True, "dualView": False, "pricingCostBasis": "AMC"}
        if isinstance(stored, str):
            try:
                return json.loads(stored)
            except Exception:
                return {}
        return stored

    @staticmethod
    def save_global_settings(organization, config):
        """Save global financial settings into Organization.settings JSON."""
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
